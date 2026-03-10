import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "./layouts/Sidebar";
import { Topbar } from "./layouts/Topbar";
import { LibraryPage } from "./pages/LibraryPage";
import { SeriesListPage, SeriesDetailPage } from "./pages/SeriesPage";
import { InboxPage } from "./pages/InboxPage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { RulesPage } from "./pages/RulesPage";
import { ActorsPage, StudiosPage, TagsPage, CollectionsPage } from "./pages/CatalogPages";
import { EditMoviePage } from "./pages/EditMoviePage";
import { EditSeriesPage } from "./pages/EditSeriesPage";
import { EditPersonPage } from "./pages/EditPersonPage";
import { EditStudioPage } from "./pages/EditStudioPage";
import { DuplicatesPage } from "./pages/DuplicatesPage";
import { SuggestionsPage } from "./pages/SuggestionsPage";
import { ImportPage } from "./pages/ImportPage";
import { DropZone } from "./components/DropZone";
import { LoadingSpinner, ErrorPanel } from "./components/ui";
import { FilterBar, type ActiveFilters, EMPTY_FILTERS } from "./components/FilterBar";
import { ToastProvider, useToast } from "./components/Toast";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Movie, Series, Person, StudioFull } from "./lib/api";
import * as api from "./lib/api";
import {
  useMovies,
  useSeriesList,
  useSeriesDetail,
  useCurrentDatabase,
  useRecentDatabases,
  useOpenDatabase,
  useCreateDatabase,
  useLibraries,
  useTags,
  useRules,
  useInboxItems,
  useInboxCount,
  useImportDroppedPaths,
  // Mutation hooks for page callbacks
  useScanLibrary,
  useCreateLibrary,
  useSetTmdbApiKey,
  useToggleRule,
  useDeleteRule,
  useCreateRule,
  useApplyRulesLibrary,
  useResolveInboxLink,
  useResolveInboxIgnore,
  useCreateTag,
  useDeleteTag,
  // CRUD hooks
  usePeople,
  useStudios,
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useAddCollectionItem,
  useGenres,
} from "./lib/hooks";

// ============================================================================
// Query Client
// ============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// ============================================================================
// Page titles
// ============================================================================

const PAGE_TITLES: Record<string, string> = {
  library: "Bibliothèque",
  series: "Séries",
  series_detail: "Détail série",
  actors: "Acteurs",
  studios: "Studios",
  tags: "Tags",
  collections: "Collections",
  inbox: "Inbox",
  rules: "Règles",
  stats: "Statistiques",
  duplicates: "Doublons",
  suggestions: "Suggestions",
  settings: "Paramètres",
  edit_movie: "Éditer film",
  edit_series: "Éditer série",
  edit_person: "Éditer personne",
  edit_studio: "Éditer studio",
};

// ============================================================================
// Main App (inside providers)
// ============================================================================

function AppInner() {
  const { toast } = useToast();
  const [page, setPage] = useState("library");
  const [importInitialPaths, setImportInitialPaths] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");
  const [compactTable, setCompactTable] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("mm-theme") as "light" | "dark") || "light";
  });
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingStudio, setEditingStudio] = useState<StudioFull | null>(null);
  const [navigateToPersonId, setNavigateToPersonId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);

  // ── Data hooks (with loading/error states) ──
  const moviesQuery = useMovies();
  const seriesListQuery = useSeriesList();
  const seriesDetailQuery = useSeriesDetail(selectedSeriesId ?? 0);
  const { data: currentDb } = useCurrentDatabase();
  const { data: recentDbs = [] } = useRecentDatabases();
  const librariesQuery = useLibraries();
  const tagsQuery = useTags();
  const rulesQuery = useRules();
  const inboxQuery = useInboxItems();
  const { data: inboxCount = 0 } = useInboxCount();
  const peopleQuery = usePeople();
  const studiosQuery = useStudios();
  const collectionsQuery = useCollections();
  const { data: genres = [] } = useGenres();

  // Shorthand data with defaults
  const movies = moviesQuery.data ?? [];
  const seriesList = seriesListQuery.data ?? [];
  const libraries = librariesQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const inboxItems = inboxQuery.data ?? [];

  // ── Mutation hooks ──
  const openDatabase = useOpenDatabase();
  const createDatabase = useCreateDatabase();
  const importDropped = useImportDroppedPaths();
  const scanLibrary = useScanLibrary();
  const createLibrary = useCreateLibrary();
  const setTmdbKey = useSetTmdbApiKey();
  const toggleRule = useToggleRule();
  const deleteRule = useDeleteRule();
  const createRule = useCreateRule();
  const applyRules = useApplyRulesLibrary();
  const resolveInboxLink = useResolveInboxLink();
  const resolveInboxIgnore = useResolveInboxIgnore();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const addCollectionItem = useAddCollectionItem();

  // ── Theme ──
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("mm-theme", theme);
  }, [theme]);

  useEffect(() => {
    setSearchQuery("");
    setFilters(EMPTY_FILTERS);
  }, [page]);

  // FFprobe startup check
  useEffect(() => {
    api.checkFfprobe().then((status) => {
      if (!status.available) {
        toast("FFprobe non détecté — l'analyse technique des fichiers sera indisponible. Voir Paramètres > Général.", "info");
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation ──
  const handleNavigate = useCallback((p: string) => {
    setPage(p);
    setSelectedSeriesId(null);
    setEditingMovie(null);
    setEditingSeries(null);
    setEditingPerson(null);
    setEditingStudio(null);
  }, []);

  const handleSelectSeries = useCallback((id: number) => {
    setSelectedSeriesId(id);
    setPage("series_detail");
  }, []);

  const handleEditMovie = useCallback((movie: Movie) => {
    setEditingMovie(movie);
    setPage("edit_movie");
  }, []);

  const handleEditSeries = useCallback((series: Series) => {
    setEditingSeries(series);
    setPage("edit_series");
  }, []);

  const handleEditPerson = useCallback((person: Person) => {
    setEditingPerson(person);
    setPage("edit_person");
  }, []);

  const handleEditStudio = useCallback((studio: StudioFull) => {
    setEditingStudio(studio);
    setPage("edit_studio");
  }, []);

  const handleNavigateToPerson = useCallback((personId: number) => {
    setNavigateToPersonId(personId);
    setPage("actors");
  }, []);

  // ── Drag & drop ──
  const handleDrop = useCallback(
    (paths: string[]) => {
      importDropped.mutate(paths, {
        onSuccess: (result) => {
          toast(`${result.files_found} fichiers importés (${result.movies} films, ${result.episodes} épisodes)`, "success");
        },
        onError: (err) => toast(`Erreur d'import : ${err}`, "error"),
      });
    },
    [importDropped, toast]
  );

  // ── File picker dialogs (Tâche 4) ──
  const handleBrowseDatabase = useCallback(async () => {
    try {
      const selected = await open({
        title: "Ouvrir une base de données",
        filters: [{ name: "SQLite", extensions: ["db", "sqlite", "sqlite3"] }],
        multiple: false,
      });
      if (selected) {
        openDatabase.mutate(selected as string, {
          onSuccess: () => toast("Base de données ouverte", "success"),
          onError: (err) => toast(`Erreur : ${err}`, "error"),
        });
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }, [openDatabase, toast]);

  const handleCreateDatabase = useCallback(async () => {
    try {
      const selected = await save({
        title: "Créer une nouvelle base de données",
        filters: [{ name: "SQLite", extensions: ["db"] }],
        defaultPath: "moviemanager.db",
      });
      if (selected) {
        createDatabase.mutate(selected, {
          onSuccess: () => toast("Nouvelle base créée", "success"),
          onError: (err) => toast(`Erreur : ${err}`, "error"),
        });
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }, [createDatabase, toast]);

  const handleImport = useCallback(async () => {
    try {
      const selected = await open({
        title: "Importer des fichiers vidéo",
        directory: true,
        multiple: true,
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        setImportInitialPaths(paths);
        setPage("import");
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }, []);

  const handleAddLibrary = useCallback(async () => {
    try {
      const selected = await open({
        title: "Sélectionner un dossier de bibliothèque",
        directory: true,
        multiple: false,
      });
      if (selected) {
        const name = (selected as string).split(/[\\/]/).pop() || "Nouvelle bibliothèque";
        createLibrary.mutate(
          { name, path: selected as string, lib_type: "hdd" },
          {
            onSuccess: () => toast(`Bibliothèque "${name}" ajoutée`, "success"),
            onError: (err) => toast(`Erreur : ${err}`, "error"),
          }
        );
      }
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }, [createLibrary, toast]);

  // ── Page callbacks (Tâche 2) ──

  // Rules
  const handleToggleRule = useCallback(
    (id: number, enabled: boolean) => {
      toggleRule.mutate({ id, enabled }, {
        onSuccess: () => toast(enabled ? "Règle activée" : "Règle désactivée", "info"),
      });
    },
    [toggleRule, toast]
  );

  const handleDeleteRule = useCallback(
    (id: number) => {
      deleteRule.mutate(id, {
        onSuccess: () => toast("Règle supprimée", "success"),
      });
    },
    [deleteRule, toast]
  );

  const handleCreateRule = useCallback(
    (rule: { name: string; condition: { field: string; operator: string; value: string }; action: { action_type: string; value: string } }) => {
      createRule.mutate(
        { name: rule.name, condition: rule.condition, action: rule.action },
        { onSuccess: () => toast(`Règle "${rule.name}" créée`, "success") }
      );
    },
    [createRule, toast]
  );

  const handleApplyAllRules = useCallback(() => {
    if (libraries.length > 0) {
      applyRules.mutate(libraries[0].id, {
        onSuccess: (results) =>
          toast(`Règles appliquées sur ${results.length} élément(s)`, "success"),
        onError: (err) => toast(`Erreur : ${err}`, "error"),
      });
    }
  }, [applyRules, libraries, toast]);

  // Inbox
  const handleResolveInbox = useCallback(
    (id: number, action: "link" | "ignore", tmdbId?: number, entityType?: "movie" | "series") => {
      if (action === "ignore") {
        resolveInboxIgnore.mutate(id, {
          onSuccess: () => toast("Élément ignoré", "info"),
        });
      } else if (action === "link" && tmdbId) {
        resolveInboxLink.mutate(
          { inboxId: id, entityType: entityType || "movie", entityId: tmdbId },
          { onSuccess: () => toast("Élément lié avec succès", "success") }
        );
      }
    },
    [resolveInboxIgnore, resolveInboxLink, toast]
  );

  // Tags
  const handleCreateTag = useCallback(
    (name: string, color?: string) => {
      createTag.mutate({ name, color }, {
        onSuccess: () => toast(`Tag "${name}" créé`, "success"),
      });
    },
    [createTag, toast]
  );

  const handleDeleteTag = useCallback(
    (id: number) => {
      deleteTag.mutate(id, {
        onSuccess: () => toast("Tag supprimé", "success"),
      });
    },
    [deleteTag, toast]
  );

  // Collections
  const handleCreateCollection = useCallback(
    (name: string, description?: string) => {
      createCollection.mutate({ name, description }, {
        onSuccess: () => toast(`Collection "${name}" créée`, "success"),
        onError: (err) => toast(`Erreur : ${err}`, "error"),
      });
    },
    [createCollection, toast]
  );

  const handleDeleteCollection = useCallback(
    (id: number) => {
      deleteCollection.mutate(id, {
        onSuccess: () => toast("Collection supprimée", "success"),
        onError: (err) => toast(`Erreur : ${err}`, "error"),
      });
    },
    [deleteCollection, toast]
  );

  const handleAddMovieToCollection = useCallback(
    (movieId: number, collectionId: number) => {
      addCollectionItem.mutate({ collectionId, movieId }, {
        onSuccess: () => {
          const name = collectionsQuery.data?.find((c) => c.id === collectionId)?.name ?? "collection";
          toast(`Film ajouté à "${name}"`, "success");
        },
        onError: (err) => toast(`Erreur : ${err}`, "error"),
      });
    },
    [addCollectionItem, collectionsQuery.data, toast]
  );

  // Settings
  const handleScanLibrary = useCallback(
    (id: number) => {
      scanLibrary.mutate(id, {
        onSuccess: (result) =>
          toast(`Scan terminé : ${result.files_found} fichiers trouvés`, "success"),
        onError: (err) => toast(`Erreur de scan : ${err}`, "error"),
      });
    },
    [scanLibrary, toast]
  );

  const handleSetTmdbKey = useCallback(
    (key: string) => {
      setTmdbKey.mutate({ key }, {
        onSuccess: () => toast("Clé TMDB enregistrée", "success"),
        onError: (err) => toast(`Erreur : ${err}`, "error"),
      });
    },
    [setTmdbKey, toast]
  );

  const handleBackup = useCallback(async () => {
    try {
      const defaultName = await api.getBackupFilename();
      const selected = await save({
        defaultPath: defaultName,
        filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
      });
      if (!selected) return; // user cancelled
      toast("Backup en cours…", "info");
      const result = await api.createBackup(selected);
      const sizeMb = (result.total_size_bytes / (1024 * 1024)).toFixed(1);
      toast(`Backup terminé : ${sizeMb} Mo (${result.image_count} images)`, "success");
    } catch (err) {
      toast(`Erreur de backup : ${err}`, "error");
    }
  }, [toast]);

  const handleImportNfo = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Sélectionner un dossier contenant des fichiers NFO",
      });
      if (!selected) return;
      toast("Import NFO en cours…", "info");
      const result = await api.importNfoDirectory(selected);
      const parts = [];
      if (result.movies_imported > 0) parts.push(`${result.movies_imported} film(s)`);
      if (result.series_imported > 0) parts.push(`${result.series_imported} série(s)`);
      if (result.errors.length > 0) parts.push(`${result.errors.length} erreur(s)`);
      toast(`Import NFO terminé : ${parts.join(", ") || "aucun fichier trouvé"}`, result.errors.length > 0 ? "info" : "success");
    } catch (err) {
      toast(`Erreur d'import NFO : ${err}`, "error");
    }
  }, [toast]);

  const handleExportJson = useCallback(async () => {
    try {
      const selected = await save({
        defaultPath: "moviemanager_export.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      const result = await api.exportJson(selected);
      toast(`Export JSON terminé : ${result.movies_count} films, ${result.series_count} séries`, "success");
    } catch (err) {
      toast(`Erreur d'export : ${err}`, "error");
    }
  }, [toast]);

  const handleExportCsv = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        title: "Sélectionner un dossier pour l'export CSV",
      });
      if (!selected) return;
      const result = await api.exportCsv(selected);
      toast(`Export CSV terminé : ${result.movies_count} films, ${result.series_count} séries (movies.csv + series.csv)`, "success");
    } catch (err) {
      toast(`Erreur d'export : ${err}`, "error");
    }
  }, [toast]);

  const pageTitle = PAGE_TITLES[page] || "MovieManager";

  // ── Helper: wrap a page with loading/error states ──
  const withLoadingError = (
    query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void },
    content: ReactNode,
    loadingMsg?: string
  ) => {
    if (query.isLoading) return <LoadingSpinner message={loadingMsg} />;
    if (query.isError) return <ErrorPanel message={String(query.error)} onRetry={query.refetch} />;
    return content;
  };

  return (
    <DropZone onDrop={handleDrop}>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          fontFamily: "'Inter', 'Segoe UI', Roboto, sans-serif",
          fontSize: 14,
          color: "var(--text-main)",
          background: "var(--bg-app)",
          overflow: "hidden",
        }}
      >
        <Sidebar
          currentPage={page}
          onNavigate={handleNavigate}
          inboxCount={inboxCount}
          currentDb={currentDb ?? null}
          recentDbs={recentDbs}
          onOpenDatabase={(path) =>
            openDatabase.mutate(path, {
              onSuccess: () => toast("Base de données ouverte", "success"),
            })
          }
          onCreateDatabase={handleCreateDatabase}
          onBrowseDatabase={handleBrowseDatabase}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Topbar
            title={pageTitle}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewSwitch={page === "library"}
            compact={compactTable}
            onCompactToggle={() => setCompactTable((c) => !c)}
            theme={theme}
            onThemeToggle={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            onImport={handleImport}
            searchRef={searchRef}
          />

          {(page === "library" || page === "series") && (
            <FilterBar
              filters={filters}
              onChange={setFilters}
              genres={genres}
              libraries={libraries}
              showCompleteness={page === "series"}
            />
          )}

          <div style={{ flex: 1, overflow: "hidden" }}>
            {page === "library" &&
              withLoadingError(moviesQuery,
                <LibraryPage
                  movies={movies}
                  viewMode={viewMode}
                  compact={compactTable}
                  searchQuery={searchQuery}
                  filters={filters}
                  onEditMovie={handleEditMovie}
                  onNavigateToPerson={handleNavigateToPerson}
                  onFocusSearch={() => searchRef.current?.focus()}
                  collections={collectionsQuery.data?.map((c) => ({ id: c.id, name: c.name })) ?? []}
                  onAddToCollection={handleAddMovieToCollection}
                />,
                "Chargement de la bibliothèque…"
              )}

            {page === "series" &&
              withLoadingError(seriesListQuery,
                <SeriesListPage
                  seriesList={seriesList}
                  searchQuery={searchQuery}
                  filters={filters}
                  onSelectSeries={handleSelectSeries}
                  onEditSeries={handleEditSeries}
                />,
                "Chargement des séries…"
              )}

            {page === "series_detail" && selectedSeriesId && (
              seriesDetailQuery.isLoading
                ? <LoadingSpinner message="Chargement du détail…" />
                : seriesDetailQuery.isError
                  ? <ErrorPanel message={String(seriesDetailQuery.error)} onRetry={seriesDetailQuery.refetch} />
                  : seriesDetailQuery.data && (
                    <SeriesDetailPage
                      detail={seriesDetailQuery.data}
                      onBack={() => setPage("series")}
                      onEdit={() => handleEditSeries(seriesDetailQuery.data!)}
                    />
                  )
            )}

            {page === "edit_movie" && editingMovie && (
              <EditMoviePage
                movie={editingMovie}
                onSave={() => {
                  toast("Film enregistré", "success");
                  setEditingMovie(null);
                  setPage("library");
                }}
                onCancel={() => { setEditingMovie(null); setPage("library"); }}
              />
            )}

            {page === "edit_series" && editingSeries && (
              <EditSeriesPage
                series={editingSeries}
                onSave={() => {
                  toast("Série enregistrée", "success");
                  setEditingSeries(null);
                  setPage("series");
                }}
                onCancel={() => { setEditingSeries(null); setPage("series"); }}
              />
            )}

            {page === "edit_person" && editingPerson && (
              <EditPersonPage
                person={editingPerson}
                onSave={() => {
                  toast("Personne enregistrée", "success");
                  setEditingPerson(null);
                  setPage("actors");
                }}
                onCancel={() => { setEditingPerson(null); setPage("actors"); }}
              />
            )}

            {page === "edit_studio" && editingStudio && (
              <EditStudioPage
                studio={editingStudio}
                onSave={() => {
                  toast("Studio enregistré", "success");
                  setEditingStudio(null);
                  setPage("studios");
                }}
                onCancel={() => { setEditingStudio(null); setPage("studios"); }}
              />
            )}

            {page === "actors" &&
              withLoadingError(peopleQuery,
                <ActorsPage
                  actors={peopleQuery.data ?? []}
                  searchQuery={searchQuery}
                  onEditPerson={handleEditPerson}
                  initialSelectedId={navigateToPersonId}
                  onSelectedConsumed={() => setNavigateToPersonId(null)}
                />,
                "Chargement des acteurs…"
              )}

            {page === "studios" &&
              withLoadingError(studiosQuery,
                <StudiosPage studios={studiosQuery.data ?? []} searchQuery={searchQuery} onEditStudio={handleEditStudio} />,
                "Chargement des studios…"
              )}

            {page === "tags" &&
              withLoadingError(tagsQuery,
                <TagsPage
                  tags={tags.map((t) => ({
                    id: t.id,
                    name: t.name,
                    color: t.color ?? null,
                    auto_generated: t.auto_generated,
                    usage_count: 0,
                  }))}
                  onCreateTag={handleCreateTag}
                  onDeleteTag={handleDeleteTag}
                />,
                "Chargement des tags…"
              )}

            {page === "collections" &&
              withLoadingError(collectionsQuery,
                <CollectionsPage
                  collections={collectionsQuery.data ?? []}
                  movieIndex={Object.fromEntries(movies.map((m) => [m.id, m.title]))}
                  seriesIndex={Object.fromEntries(seriesList.map((s) => [s.id, s.title]))}
                  onCreateCollection={handleCreateCollection}
                  onDeleteCollection={handleDeleteCollection}
                />,
                "Chargement des collections…"
              )}

            {page === "inbox" &&
              withLoadingError(inboxQuery,
                <InboxPage
                  items={inboxItems}
                  onResolve={handleResolveInbox}
                />,
                "Chargement de l'inbox…"
              )}

            {page === "rules" &&
              withLoadingError(rulesQuery,
                <RulesPage
                  rules={rules}
                  onToggle={handleToggleRule}
                  onDelete={handleDeleteRule}
                  onCreate={handleCreateRule}
                  onApplyAll={handleApplyAllRules}
                />,
                "Chargement des règles…"
              )}

            {page === "stats" && <StatsPage />}
            {page === "duplicates" && <DuplicatesPage />}
            {page === "suggestions" && <SuggestionsPage />}
            {page === "import" && (
              <ImportPage
                initialPaths={importInitialPaths}
                onPathsConsumed={() => setImportInitialPaths([])}
              />
            )}

            {page === "settings" &&
              withLoadingError(librariesQuery,
                <SettingsPage
                  libraries={libraries}
                  onScanLibrary={handleScanLibrary}
                  onCreateLibrary={handleAddLibrary}
                  onSetTmdbKey={handleSetTmdbKey}
                  currentDbName={currentDb?.name}
                  currentDbPath={currentDb?.path}
                  recentDatabases={recentDbs}
                  onOpenDatabase={(path) =>
                    openDatabase.mutate(path, {
                      onSuccess: () => toast("Base de données ouverte", "success"),
                    })
                  }
                  onCreateDatabase={handleCreateDatabase}
                  onBackup={handleBackup}
                  onImportNfo={handleImportNfo}
                  onExportJson={handleExportJson}
                  onExportCsv={handleExportCsv}
                />,
                "Chargement des paramètres…"
              )}
          </div>
        </div>
      </div>
    </DropZone>
  );
}

// ============================================================================
// Root wrapper
// ============================================================================

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </QueryClientProvider>
  );
}
