import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ScoreBadge, SectionTitle } from "../components/ui";
import { SmartPoster } from "../components/SmartPoster";
import type { Movie } from "../lib/api";
import { tmdbImageUrl } from "../lib/api";
import { useKeyboardShortcuts } from "../lib/useKeyboardShortcuts";
import { useImage } from "../lib/useImage";
import { useMovieVersions, useMoviePeople, useSimilarMovies, useMovieFileSizes, useAllEntityImages, useMovieFileLocations, useVersionFiles, useLibraries, usePerson, usePersonMovies } from "../lib/hooks";
import { useMovieGenres } from "../lib/hooks";
import type { ActiveFilters } from "../components/FilterBar";
import type { ImageRecord } from "../lib/api";
import { LightboxModal } from "../components/LightboxModal";
import { convertFileSrc } from "@tauri-apps/api/core";

interface CollectionRef { id: number; name: string; }

type PanelView = { type: "movie"; id: number } | { type: "person"; id: number };

interface ContextMenuState { x: number; y: number; movieIds: number[]; }

interface LibraryPageProps {
  movies: Movie[];
  viewMode: "table" | "gallery";
  compact?: boolean;
  searchQuery: string;
  filters?: ActiveFilters;
  onEditMovie?: (movie: Movie) => void;
  onNavigateToPerson?: (personId: number) => void;
  onFocusSearch?: () => void;
  collections?: CollectionRef[];
  onAddToCollection?: (movieId: number, collectionId: number) => void;
}

type SortKey = "title" | "year" | "runtime" | "score" | "format" | "size";
type SortDir = "asc" | "desc";

export function LibraryPage({ movies, viewMode, compact = false, searchQuery, filters, onEditMovie, onNavigateToPerson: _onNavigateToPerson, onFocusSearch, collections = [], onAddToCollection }: LibraryPageProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [panelStack, setPanelStack] = useState<PanelView[]>([]);
  const [multiSelect, setMultiSelect] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { data: fileSizeMap } = useMovieFileSizes();
  const { data: fileLocationMap } = useMovieFileLocations();

  // Select a movie from the table (resets panel sub-navigation)
  const selectMovie = useCallback((id: number | null) => {
    setSelectedId(id);
    setPanelStack([]);
  }, []);

  // Push a movie into the panel navigation stack (doesn't change table selection)
  const handlePanelSelectMovie = useCallback((id: number) => {
    setPanelStack((prev) => [...prev, { type: "movie", id }]);
  }, []);

  // Push a person into the panel navigation stack
  const handlePanelSelectPerson = useCallback((id: number) => {
    setPanelStack((prev) => [...prev, { type: "person", id }]);
  }, []);

  const handlePanelBack = useCallback(() => {
    setPanelStack((prev) => prev.slice(0, -1));
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedId(null);
    setPanelStack([]);
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const handleMultiToggle = useCallback((movieId: number) => {
    setMultiSelect((prev) => {
      const next = new Set(prev);
      if (next.has(movieId)) next.delete(movieId);
      else next.add(movieId);
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => setMultiSelect(new Set()), []);

  const handleContextMenu = useCallback((e: React.MouseEvent, movieId: number) => {
    e.preventDefault();
    if (!collections.length) return;
    // If right-clicking a multi-selected movie, operate on all selected
    const ids = multiSelect.has(movieId) && multiSelect.size > 1
      ? Array.from(multiSelect)
      : [movieId];
    setContextMenu({ x: e.clientX, y: e.clientY, movieIds: ids });
  }, [collections.length, multiSelect]);

  const filtered = useMemo(() => {
    let result = movies;

    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.original_title?.toLowerCase().includes(q) ||
          m.year?.toString().includes(q)
      );
    }

    // Filters
    if (filters) {
      if (filters.score) {
        result = result.filter((m) => m.primary_quality_score === filters.score);
      }
      if (filters.yearFrom) {
        result = result.filter((m) => m.year != null && m.year >= filters.yearFrom!);
      }
      if (filters.yearTo) {
        result = result.filter((m) => m.year != null && m.year <= filters.yearTo!);
      }
      if (filters.owned === "yes") {
        result = result.filter((m) => m.owned);
      } else if (filters.owned === "no") {
        result = result.filter((m) => !m.owned);
      }
      // Genre filtering requires genre data on movies — will work when genres
      // are loaded per-movie. For now, genre filter is a no-op placeholder.
    }

    // Sort
    const scoreOrder: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
    const dir = sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "year":
          cmp = (a.year ?? 0) - (b.year ?? 0);
          break;
        case "runtime":
          cmp = (a.runtime ?? 0) - (b.runtime ?? 0);
          break;
        case "score":
        case "format":
          cmp = (scoreOrder[a.primary_quality_score ?? ""] ?? 0) - (scoreOrder[b.primary_quality_score ?? ""] ?? 0);
          break;
        case "size":
          cmp = (fileSizeMap?.get(a.id) ?? 0) - (fileSizeMap?.get(b.id) ?? 0);
          break;
      }
      return cmp * dir;
    });

    return result;
  }, [movies, searchQuery, filters, sortKey, sortDir, fileSizeMap]);

  // The movie currently selected in the table (for keyboard nav + edit shortcut)
  const selected = filtered.find((m) => m.id === selectedId) || null;

  // Panel view: top of stack, or fall back to the table-selected movie
  const panelView: PanelView | null =
    panelStack.length > 0
      ? panelStack[panelStack.length - 1]
      : selectedId !== null
      ? { type: "movie", id: selectedId }
      : null;

  // Movie shown in panel (may not be in filtered list — look in all movies)
  const panelMovie =
    panelView?.type === "movie" ? (movies.find((m) => m.id === panelView.id) ?? null) : null;

  const canGoBack = panelStack.length > 0;
  const panelOpen = panelView !== null && (panelMovie !== null || panelView.type === "person");

  // Keyboard navigation
  const selectedIndex = filtered.findIndex((m) => m.id === selectedId);

  useKeyboardShortcuts({
    onArrowUp: useCallback(() => {
      if (filtered.length === 0) return;
      const idx = selectedIndex > 0 ? selectedIndex - 1 : 0;
      selectMovie(filtered[idx].id);
    }, [filtered, selectedIndex, selectMovie]),
    onArrowDown: useCallback(() => {
      if (filtered.length === 0) return;
      const idx = selectedIndex < filtered.length - 1 ? selectedIndex + 1 : selectedIndex;
      selectMovie(filtered[idx].id);
    }, [filtered, selectedIndex, selectMovie]),
    onEdit: useCallback(() => {
      if (selected && onEditMovie) onEditMovie(selected);
    }, [selected, onEditMovie]),
    onSearch: onFocusSearch,
    onEscape: useCallback(() => { handlePanelClose(); clearMultiSelect(); }, [handlePanelClose, clearMultiSelect]),
  });

  const handleAddBatch = useCallback((collectionId: number) => {
    for (const movieId of multiSelect) {
      onAddToCollection?.(movieId, collectionId);
    }
    clearMultiSelect();
  }, [multiSelect, onAddToCollection, clearMultiSelect]);

  if (viewMode === "gallery") {
    return (
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <GalleryView
          movies={filtered}
          onSelect={selectMovie}
          onContextMenu={handleContextMenu}
          multiSelect={multiSelect}
          onMultiToggle={handleMultiToggle}
          onDoubleClick={onEditMovie}
        />
        {multiSelect.size > 0 && (
          <SelectionBar
            count={multiSelect.size}
            collections={collections}
            onAddToCollection={handleAddBatch}
            onClear={clearMultiSelect}
          />
        )}
        {contextMenu && (
          <ContextMenu
            {...contextMenu}
            collections={collections}
            onAdd={(collectionId) => {
              contextMenu.movieIds.forEach((id) => onAddToCollection?.(id, collectionId));
              setContextMenu(null);
            }}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", height: 0, minHeight: "100%" }}>
      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <MovieTable
          movies={filtered}
          selectedId={selectedId}
          onSelect={selectMovie}
          compact={compact}
          onContextMenu={handleContextMenu}
          multiSelect={multiSelect}
          onMultiToggle={handleMultiToggle}
          onDoubleClick={onEditMovie}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={toggleSort}
          fileSizeMap={fileSizeMap}
          fileLocationMap={fileLocationMap}
        />
      </div>

      {/* Sliding detail panel */}
      <div
        style={{
          width: 340,
          flexShrink: 0,
          borderLeft: "1px solid var(--border)",
          background: "var(--bg-surface)",
          overflowY: "auto",
          transition: "margin-right 0.25s ease, opacity 0.2s ease",
          marginRight: panelOpen ? 0 : -340,
          opacity: panelOpen ? 1 : 0,
        }}
      >
        {panelView?.type === "movie" && panelMovie && (
          <MovieDetailPanel
            movie={panelMovie}
            onEdit={onEditMovie && panelMovie.id === selectedId ? () => onEditMovie(panelMovie) : undefined}
            onPersonClick={handlePanelSelectPerson}
            onSelectMovie={handlePanelSelectMovie}
            onClose={handlePanelClose}
            canGoBack={canGoBack}
            onBack={handlePanelBack}
          />
        )}
        {panelView?.type === "person" && (
          <PersonMiniPanel
            personId={panelView.id}
            canGoBack={canGoBack}
            onBack={handlePanelBack}
            onClose={handlePanelClose}
            onSelectMovie={handlePanelSelectMovie}
          />
        )}
      </div>

      {multiSelect.size > 0 && (
        <SelectionBar
          count={multiSelect.size}
          collections={collections}
          onAddToCollection={handleAddBatch}
          onClear={clearMultiSelect}
        />
      )}

      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          collections={collections}
          onAdd={(collectionId) => {
            contextMenu.movieIds.forEach((id) => onAddToCollection?.(id, collectionId));
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Movie Table
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} Go`;
  const mb = bytes / (1024 * 1024);
  return `${Math.round(mb)} Mo`;
}

function MovieTable({
  movies,
  selectedId,
  onSelect,
  compact = false,
  onContextMenu,
  multiSelect = new Set(),
  onMultiToggle,
  onDoubleClick,
  sortKey,
  sortDir,
  onSort,
  fileSizeMap,
  fileLocationMap,
}: {
  movies: Movie[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  compact?: boolean;
  onContextMenu?: (e: React.MouseEvent, movieId: number) => void;
  multiSelect?: Set<number>;
  onMultiToggle?: (id: number) => void;
  onDoubleClick?: (movie: Movie) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  fileSizeMap?: Map<number, number>;
  fileLocationMap?: Map<number, import("../lib/api").MovieFileLocation>;
}) {
  const columns: { label: string; key: SortKey | null }[] = compact
    ? [
        { label: "Titre", key: "title" },
        { label: "Année", key: "year" },
        { label: "Durée", key: "runtime" },
        { label: "Score", key: "score" },
        { label: "Format", key: "format" },
        { label: "Taille", key: "size" },
        { label: "Emplacement", key: null },
      ]
    : [
        { label: "", key: null },
        { label: "Titre", key: "title" },
        { label: "Année", key: "year" },
        { label: "Durée", key: "runtime" },
        { label: "Score", key: "score" },
        { label: "Format", key: "format" },
        { label: "Taille", key: "size" },
        { label: "Emplacement", key: null },
      ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr
          style={{
            background: "var(--bg-surface-alt)",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          {columns.map((col, i) => (
            <th
              key={i}
              onClick={() => col.key && onSort(col.key)}
              style={{
                padding: "8px 10px",
                textAlign: "left",
                fontWeight: 500,
                color: "var(--text-secondary)",
                fontSize: 12,
                borderBottom: "1px solid var(--border)",
                whiteSpace: "nowrap",
                cursor: col.key ? "pointer" : "default",
                userSelect: "none",
              }}
            >
              {col.label}
              {col.key && col.key === sortKey && (
                <span style={{ marginLeft: 4, fontSize: 10 }}>
                  {sortDir === "asc" ? "▲" : "▼"}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {movies.map((m, i) => {
          const isSelected = m.id === selectedId;
          return (
            <tr
              key={m.id}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) { onMultiToggle?.(m.id); }
                else { onSelect(m.id); }
              }}
              onDoubleClick={() => onDoubleClick?.(m)}
              onContextMenu={(e) => onContextMenu?.(e, m.id)}
              style={{
                cursor: "pointer",
                background: multiSelect.has(m.id)
                  ? "var(--row-multiselect-bg)"
                  : isSelected
                    ? "var(--color-primary-soft)"
                    : i % 2 === 0
                      ? "var(--bg-surface)"
                      : "var(--row-odd-bg)",
                transition: "background 0.1s",
                outline: multiSelect.has(m.id) ? "2px solid var(--warning)" : undefined,
                outlineOffset: -2,
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = "var(--row-hover-bg)";
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.background =
                    i % 2 === 0 ? "var(--bg-surface)" : "var(--row-odd-bg)";
              }}
            >
              {!compact && (
                <td style={{ padding: "6px 10px", width: 42 }}>
                  <SmartPoster
                    entityType="movie"
                    entityId={m.id}
                    title={m.title}
                    tmdbPosterPath={m.poster_path}
                    size="small"
                  />
                </td>
              )}
              <td
                style={{
                  padding: compact ? "4px 10px" : "6px 10px",
                  maxWidth: 260,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ fontWeight: 500 }}>{m.title}</div>
                <MovieDirectorsLine movieId={m.id} />
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-muted)" }}>
                {m.year || "—"}
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-muted)" }}>
                {m.runtime ? `${m.runtime} min` : "—"}
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px" }}>
                <ScoreBadge score={m.primary_quality_score} />
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-secondary)", fontSize: 12 }}>
                {m.primary_quality_score === "A"
                  ? "4K HDR"
                  : m.primary_quality_score === "B"
                    ? "1080p"
                    : m.primary_quality_score === "C"
                      ? "720p"
                      : "SD"}
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", color: "var(--text-muted)", fontSize: 12 }}>
                {formatFileSize(fileSizeMap?.get(m.id) ?? 0)}
              </td>
              <td style={{ padding: compact ? "4px 10px" : "6px 10px", maxWidth: 180, overflow: "hidden" }}>
                <LocationBadge loc={fileLocationMap?.get(m.id)} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Compact location badge: volume label + filename */
function LocationBadge({ loc }: { loc: import("../lib/api").MovieFileLocation | undefined }) {
  if (!loc) return <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>;
  const label = loc.volume_label || loc.library_name;
  return (
    <div title={loc.file_path} style={{ cursor: "default" }}>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        color: "var(--color-primary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 9,
        color: "var(--text-muted)",
        fontFamily: "monospace",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {loc.file_name}
      </div>
    </div>
  );
}

/** Displays directors under the movie title in the table row */
function MovieDirectorsLine({ movieId }: { movieId: number }) {
  const { data: people } = useMoviePeople(movieId);
  const directors = people?.filter((p) => p.role === "director") ?? [];
  if (directors.length === 0) return null;
  return (
    <div
      style={{
        fontSize: 9,
        fontStyle: "italic",
        color: "var(--text-muted)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.3,
      }}
    >
      {directors.map((d) => d.name).join(", ")}
    </div>
  );
}

// ============================================================================
// Movie Detail Panel
// ============================================================================

// ============================================================================
// Person mini panel — shown when user clicks an actor/director in the movie panel
// ============================================================================

function PersonMiniPanel({
  personId, canGoBack, onBack, onClose, onSelectMovie,
}: {
  personId: number;
  canGoBack?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  onSelectMovie?: (movieId: number) => void;
}) {
  const { data: person } = usePerson(personId);
  const { data: personMovies } = usePersonMovies(personId);

  const navBtnStyle: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    fontSize: 16, color: "var(--text-muted)", padding: "2px 6px",
  };

  return (
    <div style={{ padding: 14 }}>
      {/* Navigation header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button
          onClick={onBack}
          title="Retour"
          style={{ ...navBtnStyle, visibility: canGoBack && onBack ? "visible" : "hidden" }}
        >
          ‹
        </button>
        <button onClick={onClose} title="Fermer le panneau" style={navBtnStyle}>›</button>
      </div>

      {/* Photo */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <SmartPoster
          entityType="person"
          entityId={personId}
          title={person?.name ?? "…"}
          tmdbPosterPath={person?.photo_path ?? null}
          size="large"
        />
      </div>

      {/* Name + role */}
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{person?.name ?? "…"}</div>
        {person?.primary_role && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, textTransform: "capitalize" }}>
            {person.primary_role}
          </div>
        )}
        {person?.birth_date && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
            {person.birth_date}
            {person.birth_place ? ` — ${person.birth_place}` : ""}
          </div>
        )}
        {person?.death_date && (
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>† {person.death_date}</div>
        )}
      </div>

      {/* Biography excerpt */}
      {person?.biography && (
        <div style={{ marginBottom: 12, textAlign: "left" }}>
          <SectionTitle>Biographie</SectionTitle>
          <p style={{
            fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.55, marginTop: 4,
            display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {person.biography}
          </p>
        </div>
      )}

      {/* Films */}
      {personMovies && personMovies.length > 0 && (
        <div style={{ textAlign: "left" }}>
          <SectionTitle>Films ({personMovies.length})</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, justifyContent: "center" }}>
            {personMovies.map((m) => (
              <div
                key={m.movie_id}
                onClick={() => onSelectMovie?.(m.movie_id)}
                title={`${m.title}${m.character_name ? ` — ${m.character_name}` : ""}`}
                style={{ width: 60, textAlign: "center", cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <SmartPoster
                  entityType="movie"
                  entityId={m.movie_id}
                  title={m.title}
                  tmdbPosterPath={m.poster_path}
                  size="small"
                />
                <div style={{
                  fontSize: 9, marginTop: 2, fontWeight: 500,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {m.title}
                </div>
                {m.year && <div style={{ fontSize: 8, color: "var(--text-muted)" }}>{m.year}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Movie detail panel
// ============================================================================

function MovieDetailPanel({ movie, onEdit, onPersonClick, onSelectMovie, onClose, canGoBack, onBack }: { movie: Movie; onEdit?: () => void; onPersonClick?: (personId: number) => void; onSelectMovie?: (movieId: number) => void; onClose?: () => void; canGoBack?: boolean; onBack?: () => void }) {
  const { data: versions } = useMovieVersions(movie.id);
  const { data: people } = useMoviePeople(movie.id);
  const { data: genres } = useMovieGenres(movie.id);
  const { data: similar } = useSimilarMovies(movie.id);
  const { data: allImages } = useAllEntityImages("movie", movie.id);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const directors = people?.filter((p) => p.role === "director") ?? [];
  const actors = people?.filter((p) => p.role === "actor") ?? [];

  // Separate images by type for display
  const backdrops = allImages?.filter((img) => img.image_type === "backdrop") ?? [];
  const photos = allImages?.filter((img) => img.image_type === "photo") ?? [];
  const galleryImages = [...backdrops, ...photos];

  const openLightbox = (image: ImageRecord) => {
    const allImgs = allImages ?? [];
    const idx = allImgs.findIndex((img) => img.id === image.id);
    if (idx >= 0) setLightboxIndex(idx);
  };

  return (
    <div style={{ padding: 14, textAlign: "center" }}>
      {/* Navigation header: back chevron (left) + close chevron (right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <button
          onClick={onBack}
          title="Retour"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 16, color: "var(--text-muted)", padding: "2px 6px",
            visibility: canGoBack && onBack ? "visible" : "hidden",
          }}
        >
          ‹
        </button>
        <button
          onClick={onClose}
          title="Fermer le panneau"
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: 16, color: "var(--text-muted)", padding: "2px 6px",
          }}
        >
          ›
        </button>
      </div>
      {/* Poster — clickable to open lightbox, with small edit icon */}
      <div
        style={{ marginBottom: 10, display: "flex", justifyContent: "center", position: "relative", cursor: "pointer" }}
        onClick={() => {
          const posterImg = allImages?.find((img) => img.image_type === "poster");
          if (posterImg) openLightbox(posterImg);
        }}
      >
        <SmartPoster
          entityType="movie"
          entityId={movie.id}
          title={movie.title}
          tmdbPosterPath={movie.poster_path}
          size="large"
        />
        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Modifier"
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "none",
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
          >
            ✎
          </button>
        )}
      </div>

      {/* Title + year */}
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{movie.title}</h2>
      {movie.original_title && movie.original_title !== movie.title && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>
          {movie.original_title}
        </p>
      )}
      <p style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 8 }}>
        {[movie.year, movie.runtime ? `${movie.runtime} min` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Score + Genres on same line */}
      {(movie.primary_quality_score || (genres && genres.length > 0)) && (
        <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", alignItems: "center" }}>
          {movie.primary_quality_score && <ScoreBadge score={movie.primary_quality_score} />}
          {genres && genres.map((g) => (
            <span
              key={g.id}
              style={{
                padding: "1px 6px",
                borderRadius: 999,
                fontSize: 9,
                fontWeight: 500,
                background: "var(--color-primary-soft)",
                color: "var(--color-primary)",
              }}
            >
              {g.name}
            </span>
          ))}
        </div>
      )}

      {/* Synopsis */}
      {movie.overview && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Synopsis</SectionTitle>
          <p style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {movie.overview}
          </p>
        </div>
      )}

      {/* Tagline */}
      {movie.tagline && (
        <p style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10 }}>
          {movie.tagline}
        </p>
      )}

      {/* Casting — 2 colonnes : réalisation | acteurs */}
      {(directors.length > 0 || actors.length > 0) && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Casting</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px", alignItems: "start" }}>
            {/* Réalisation */}
            <div>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 500 }}>Réalisation</span>
              {directors.map((d) => (
                <div
                  key={d.person_id}
                  onClick={() => onPersonClick?.(d.person_id)}
                  style={{
                    fontSize: 10, color: "var(--text-secondary)", paddingLeft: 6,
                    cursor: onPersonClick ? "pointer" : undefined,
                  }}
                  onMouseEnter={(e) => onPersonClick && (e.currentTarget.style.color = "var(--color-primary)")}
                  onMouseLeave={(e) => onPersonClick && (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  {d.name}
                </div>
              ))}
            </div>
            {/* Acteurs */}
            <div>
              <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 500 }}>Acteurs</span>
              {actors.slice(0, 6).map((a) => (
                <div
                  key={a.person_id}
                  onClick={() => onPersonClick?.(a.person_id)}
                  style={{
                    fontSize: 10, color: "var(--text-secondary)", paddingLeft: 6,
                    cursor: onPersonClick ? "pointer" : undefined,
                  }}
                  onMouseEnter={(e) => onPersonClick && (e.currentTarget.style.color = "var(--color-primary)")}
                  onMouseLeave={(e) => onPersonClick && (e.currentTarget.style.color = "var(--text-secondary)")}
                >
                  {a.name}
                  {a.character_name && (
                    <span style={{ color: "var(--text-muted)", marginLeft: 3 }}>— {a.character_name}</span>
                  )}
                </div>
              ))}
              {actors.length > 6 && (
                <div style={{ fontSize: 9, color: "var(--text-muted)", paddingLeft: 6, marginTop: 2 }}>
                  +{actors.length - 6} autres
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Gallery */}
      {galleryImages.length > 0 && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Images ({galleryImages.length})</SectionTitle>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
            {galleryImages.map((img) => {
              const thumbSrc = img.path_thumb ?? img.path_medium;
              return (
                <div
                  key={img.id}
                  onClick={() => openLightbox(img)}
                  style={{
                    width: 72,
                    height: 48,
                    borderRadius: 4,
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "var(--bg-surface-alt)",
                    border: "1px solid var(--border)",
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {thumbSrc ? (
                    <img
                      src={convertFileSrc(thumbSrc)}
                      alt={img.image_type}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      draggable={false}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "var(--text-muted)", fontSize: 9,
                    }}>
                      {img.image_type}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Versions */}
      {versions && versions.length > 0 && (
        <div style={{ marginBottom: 10, textAlign: "left" }}>
          <SectionTitle>Versions ({versions.length})</SectionTitle>
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} />
          ))}
        </div>
      )}

      {/* Notes */}
      {movie.notes && (
        <div style={{ textAlign: "left" }}>
          <SectionTitle>Notes</SectionTitle>
          <p style={{ fontSize: 10, color: "var(--text-secondary)" }}>{movie.notes}</p>
        </div>
      )}

      {/* Similar movies */}
      {similar && similar.length > 0 && (
        <div style={{ marginTop: 10, textAlign: "left" }}>
          <SectionTitle>Films similaires ({similar.length})</SectionTitle>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4, justifyContent: "center" }}>
            {similar.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectMovie?.(s.id)}
                style={{
                  width: 60,
                  textAlign: "center",
                  cursor: onSelectMovie ? "pointer" : "default",
                }}
                title={`${s.title} (${s.year ?? "?"}) — score ${s.score}`}
                onMouseEnter={(e) => onSelectMovie && (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={(e) => onSelectMovie && (e.currentTarget.style.opacity = "1")}
              >
                <SmartPoster
                  entityType="movie"
                  entityId={s.id}
                  title={s.title}
                  tmdbPosterPath={s.poster_path}
                  size="small"
                />
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    marginTop: 3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && allImages && (
        <LightboxModal
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Version Card (in detail panel)
// ============================================================================

function VersionCard({ version: v }: { version: import("../lib/api").MediaVersion }) {
  const { data: files } = useVersionFiles(v.id);
  const { data: libraries } = useLibraries();

  const libMap = new Map((libraries ?? []).map((l) => [l.id, l]));

  const techParts = [
    v.resolution,
    v.video_codec,
    v.hdr_format,
    v.container?.toUpperCase(),
  ].filter(Boolean);

  const audioParts = [
    v.audio_codec,
    v.audio_channels ? `${v.audio_channels}ch` : null,
  ].filter(Boolean);

  return (
    <div
      style={{
        padding: "5px 8px",
        borderRadius: 5,
        marginBottom: 3,
        background: "var(--bg-surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header: label + score */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, flex: 1 }}>
          {v.label || "Version principale"}
        </span>
        {v.quality_score && <ScoreBadge score={v.quality_score} />}
      </div>

      {/* 2-column body: tech info | file locations */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 8px", alignItems: "start" }}>
        {/* Left: technical data */}
        <div>
          {techParts.length > 0 && (
            <div style={{ fontSize: 9, color: "var(--text-secondary)", marginBottom: 1 }}>
              {techParts.join(" · ")}
            </div>
          )}
          {audioParts.length > 0 && (
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 1 }}>
              {audioParts.join(" · ")}
            </div>
          )}
          {v.video_bitrate && (
            <div style={{ fontSize: 8, color: "var(--text-muted)" }}>
              {Math.round(v.video_bitrate / 1000)} kbps
              {v.duration ? ` · ${Math.round(v.duration / 60)} min` : ""}
            </div>
          )}
        </div>

        {/* Right: file locations */}
        <div>
          {files && files.map((f) => {
            const lib = libMap.get(f.library_id);
            const diskLabel = lib?.volume_label || lib?.name || "Bibliothèque";
            const relativePath = lib && f.file_path.startsWith(lib.path)
              ? f.file_path.slice(lib.path.length).replace(/^[\\/]/, "")
              : f.file_name;
            return (
              <div key={f.id} title={f.file_path} style={{ cursor: "default", marginBottom: 2 }}>
                <div style={{
                  fontSize: 9, fontWeight: 600,
                  color: f.is_available ? "var(--color-primary)" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 3,
                }}>
                  <span style={{ fontSize: 7 }}>{f.is_available ? "●" : "○"}</span>
                  {diskLabel}
                </div>
                <div style={{
                  fontSize: 8, color: "var(--text-muted)", fontFamily: "monospace",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {relativePath}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Gallery View
// ============================================================================

function GalleryView({
  movies,
  onSelect,
  onContextMenu,
  multiSelect = new Set(),
  onMultiToggle,
  onDoubleClick,
}: {
  movies: Movie[];
  onSelect: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, movieId: number) => void;
  multiSelect?: Set<number>;
  onMultiToggle?: (id: number) => void;
  onDoubleClick?: (movie: Movie) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 20,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 14,
        alignContent: "start",
      }}
    >
      {movies.map((m) => (
        <GalleryCard
          key={m.id}
          movie={m}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          isMultiSelected={multiSelect.has(m.id)}
          onMultiToggle={onMultiToggle}
          onDoubleClick={onDoubleClick}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Gallery Card (with smart poster)
// ============================================================================

function GalleryCard({
  movie: m,
  onSelect,
  onContextMenu,
  isMultiSelected = false,
  onMultiToggle,
  onDoubleClick,
}: {
  movie: Movie;
  onSelect: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, movieId: number) => void;
  isMultiSelected?: boolean;
  onMultiToggle?: (id: number) => void;
  onDoubleClick?: (movie: Movie) => void;
}) {
  const cachedUrl = useImage("movie", m.id, "poster", "medium");
  const posterSrc = cachedUrl || tmdbImageUrl(m.poster_path, "w342");

  return (
    <div
      onClick={(e) => {
        if (e.ctrlKey || e.metaKey) onMultiToggle?.(m.id);
        else onSelect(m.id);
      }}
      onDoubleClick={() => onDoubleClick?.(m)}
      onContextMenu={(e) => onContextMenu?.(e, m.id)}
      style={{ cursor: "pointer", textAlign: "center" }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "150%",
          borderRadius: 6,
          overflow: "hidden",
          background: "var(--bg-surface-alt)",
          outline: isMultiSelected ? "3px solid #F59E0B" : undefined,
          outlineOffset: 2,
        }}
      >
        {isMultiSelected && (
          <div style={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#F59E0B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            fontSize: 11,
            color: "#fff",
            fontWeight: 700,
          }}>✓</div>
        )}
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={m.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {m.title.slice(0, 2).toUpperCase()}
          </div>
        )}

        {m.primary_quality_score && (
          <div style={{ position: "absolute", top: 6, right: 6 }}>
            <ScoreBadge score={m.primary_quality_score} />
          </div>
        )}
      </div>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          marginTop: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {m.title}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.year}</p>
    </div>
  );
}

// ============================================================================
// Selection Bar (floating action bar for multi-select)
// ============================================================================

function SelectionBar({
  count,
  collections,
  onAddToCollection,
  onClear,
}: {
  count: number;
  collections: CollectionRef[];
  onAddToCollection: (collectionId: number) => void;
  onClear: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setShowPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        background: "var(--color-primary)",
        color: "#fff",
        borderRadius: 28,
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        zIndex: 200,
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {count} film{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
      </span>

      <div style={{ position: "relative" }} ref={pickerRef}>
        <button
          onClick={() => setShowPicker((v) => !v)}
          style={{
            padding: "5px 14px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Ajouter à une collection ▾
        </button>

        {showPicker && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              minWidth: 200,
              zIndex: 201,
            }}
          >
            <div
              style={{
                padding: "7px 12px 5px",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderBottom: "1px solid var(--border)",
              }}
            >
              Choisir une collection
            </div>
            {collections.length === 0 && (
              <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-muted)" }}>
                Aucune collection
              </div>
            )}
            {collections.map((c) => (
              <div
                key={c.id}
                onClick={() => { onAddToCollection(c.id); setShowPicker(false); }}
                style={{
                  padding: "8px 14px",
                  cursor: "pointer",
                  color: "var(--text-main)",
                  fontSize: 13,
                  borderBottom: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onClear}
        title="Désélectionner tout"
        style={{
          border: "none",
          background: "transparent",
          color: "rgba(255,255,255,0.8)",
          cursor: "pointer",
          fontSize: 18,
          lineHeight: 1,
          padding: "0 2px",
        }}
      >
        ×
      </button>
    </div>
  );
}

// ============================================================================
// Context Menu
// ============================================================================

function ContextMenu({
  x,
  y,
  movieIds,
  collections,
  onAdd,
  onClose,
}: {
  x: number;
  y: number;
  movieIds: number[];
  collections: CollectionRef[];
  onAdd: (collectionId: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Keep menu within viewport
  const menuWidth = 220;
  const left = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const top = y;

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left,
        top,
        width: menuWidth,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        zIndex: 9999,
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <div
        style={{
          padding: "8px 12px 6px",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {movieIds.length > 1 ? `Ajouter ${movieIds.length} films à` : "Ajouter à une collection"}
      </div>
      {collections.length === 0 && (
        <div style={{ padding: "8px 12px", color: "var(--text-muted)", fontSize: 11 }}>
          Aucune collection
        </div>
      )}
      {collections.map((c) => (
        <div
          key={c.id}
          onClick={() => onAdd(c.id)}
          style={{
            padding: "7px 12px",
            cursor: "pointer",
            color: "var(--text-main)",
            borderBottom: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-alt)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {c.name}
        </div>
      ))}
    </div>
  );
}
