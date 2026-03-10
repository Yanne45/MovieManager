import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "./api";

// ============================================================================
// Query keys
// ============================================================================

export const queryKeys = {
  // Database
  currentDb: ["currentDatabase"] as const,
  recentDbs: ["recentDatabases"] as const,

  // Content
  libraries: ["libraries"] as const,
  movies: ["movies"] as const,
  movieFileSizes: ["movieFileSizes"] as const,
  movie: (id: number) => ["movie", id] as const,
  seriesList: ["seriesList"] as const,
  seriesDetail: (id: number) => ["seriesDetail", id] as const,
  tags: ["tags"] as const,

  // Tools
  rules: ["rules"] as const,
  history: (type: string, id: number) => ["history", type, id] as const,
  recentChanges: ["recentChanges"] as const,
};

// ============================================================================
// Database hooks
// ============================================================================

export function useCurrentDatabase() {
  return useQuery({
    queryKey: queryKeys.currentDb,
    queryFn: api.getCurrentDatabase,
  });
}

export function useRecentDatabases() {
  return useQuery({
    queryKey: queryKeys.recentDbs,
    queryFn: api.getRecentDatabases,
  });
}

export function useCreateDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDatabase,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.currentDb });
      qc.invalidateQueries({ queryKey: queryKeys.recentDbs });
      // Invalidate all data queries — new database is empty
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
      qc.invalidateQueries({ queryKey: queryKeys.libraries });
      qc.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

export function useOpenDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.openDatabase,
    onSuccess: () => {
      // Refresh everything — different database, different data
      qc.invalidateQueries();
    },
  });
}

// ============================================================================
// Library hooks
// ============================================================================

export function useLibraries() {
  return useQuery({
    queryKey: queryKeys.libraries,
    queryFn: api.getLibraries,
  });
}

export function useCreateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createLibrary,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.libraries }),
  });
}

export function useDeleteLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteLibrary,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.libraries }),
  });
}

// ============================================================================
// Movie hooks
// ============================================================================

export function useMovies() {
  return useQuery({
    queryKey: queryKeys.movies,
    queryFn: api.getMovies,
  });
}

export function useMovieFileSizes() {
  return useQuery({
    queryKey: queryKeys.movieFileSizes,
    queryFn: async () => {
      const rows = await api.getMovieFileSizes();
      const map = new Map<number, number>();
      for (const [movieId, size] of rows) map.set(movieId, size);
      return map;
    },
  });
}

export function useMovie(id: number) {
  return useQuery({
    queryKey: queryKeys.movie(id),
    queryFn: () => api.getMovie(id),
    enabled: id > 0,
  });
}

export function useCreateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createMovie,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.movies }),
  });
}

export function useUpdateMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<api.Movie> }) =>
      api.updateMovie(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.movie(id) });
      qc.invalidateQueries({ queryKey: queryKeys.movies });
    },
  });
}

export function useDeleteMovie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteMovie,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.movies }),
  });
}

// ============================================================================
// Series hooks
// ============================================================================

export function useSeriesList() {
  return useQuery({
    queryKey: queryKeys.seriesList,
    queryFn: api.getSeriesList,
  });
}

export function useSeriesDetail(id: number) {
  return useQuery({
    queryKey: queryKeys.seriesDetail(id),
    queryFn: () => api.getSeriesDetail(id),
    enabled: id > 0,
  });
}

// ============================================================================
// Tags hooks
// ============================================================================

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags,
    queryFn: api.getTags,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color?: string }) =>
      api.createTag(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tags }),
  });
}

// ============================================================================
// Scan hooks
// ============================================================================

export function useScanLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.scanLibrary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries });
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
    },
  });
}

export function useScanAndMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.scanAndMatchLibrary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries });
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
    },
  });
}

// ============================================================================
// TMDB hooks
// ============================================================================

export function useSetTmdbApiKey() {
  return useMutation({
    mutationFn: ({ key, language }: { key: string; language?: string }) =>
      api.setTmdbApiKey(key, language),
  });
}

// ============================================================================
// Analysis (FFprobe)
// ============================================================================

export function useAnalyzeMovieFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.analyzeMovieFiles,
    onSuccess: (_, movieId) => {
      qc.invalidateQueries({ queryKey: queryKeys.movie(movieId) });
      qc.invalidateQueries({ queryKey: queryKeys.movies });
    },
  });
}

export function useAnalyzeLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.analyzeLibrary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.libraries });
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
    },
  });
}

// ============================================================================
// Rules hooks
// ============================================================================

export function useRules() {
  return useQuery({
    queryKey: queryKeys.rules,
    queryFn: api.getRules,
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      condition,
      action,
      priority,
    }: {
      name: string;
      condition: api.RuleCondition;
      action: api.RuleAction;
      priority?: number;
    }) => api.createRule(name, condition, action, priority),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules }),
  });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.toggleRule(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.rules }),
  });
}

export function useApplyRulesLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.applyRulesLibrary,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.tags });
    },
  });
}

// ============================================================================
// History hooks
// ============================================================================

export function useEntityHistory(entityType: string, entityId: number) {
  return useQuery({
    queryKey: queryKeys.history(entityType, entityId),
    queryFn: () => api.getEntityHistory(entityType, entityId),
    enabled: entityId > 0,
  });
}

export function useRecentChanges(limit?: number) {
  return useQuery({
    queryKey: queryKeys.recentChanges,
    queryFn: () => api.getRecentChanges(limit),
  });
}

export function useRollbackChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.rollbackChange,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.recentChanges });
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
    },
  });
}

// ============================================================================
// Update Series hook
// ============================================================================

export function useUpdateSeries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<api.Series> }) =>
      api.updateSeries(id, input),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.seriesDetail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
    },
  });
}

// ============================================================================
// Update Library hook
// ============================================================================

export function useUpdateLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<api.Library> }) =>
      api.updateLibrary(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.libraries }),
  });
}

// ============================================================================
// TMDB Search hooks
// ============================================================================

export function useSearchMovieTmdb() {
  return useMutation({
    mutationFn: ({ query, year }: { query: string; year?: number }) =>
      api.searchMovieTmdb(query, year),
  });
}

export function useSearchSeriesTmdb() {
  return useMutation({
    mutationFn: ({ query, year }: { query: string; year?: number }) =>
      api.searchSeriesTmdb(query, year),
  });
}

// ============================================================================
// Inbox hooks
// ============================================================================

export const queryKeysInbox = {
  items: (status?: string) => ["inboxItems", status] as const,
  count: ["inboxCount"] as const,
};

export function useInboxItems(status?: string) {
  return useQuery({
    queryKey: queryKeysInbox.items(status),
    queryFn: () => api.getInboxItems(status),
  });
}

export function useInboxCount() {
  return useQuery({
    queryKey: queryKeysInbox.count,
    queryFn: api.getInboxCount,
    refetchInterval: 30_000, // auto-refresh badge every 30s
  });
}

export function useResolveInboxLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ inboxId, entityType, entityId }: {
      inboxId: number; entityType: string; entityId: number;
    }) => api.resolveInboxLink(inboxId, entityType, entityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeysInbox.items() });
      qc.invalidateQueries({ queryKey: queryKeysInbox.count });
    },
  });
}

export function useResolveInboxIgnore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.resolveInboxIgnore,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeysInbox.items() });
      qc.invalidateQueries({ queryKey: queryKeysInbox.count });
    },
  });
}

export function useReopenInboxItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reopenInboxItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeysInbox.items() });
      qc.invalidateQueries({ queryKey: queryKeysInbox.count });
    },
  });
}

export function useDeleteInboxItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteInboxItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeysInbox.items() });
      qc.invalidateQueries({ queryKey: queryKeysInbox.count });
    },
  });
}

// ============================================================================
// Image hooks
// ============================================================================

export function useAllEntityImages(entityType: string, entityId: number | null) {
  return useQuery({
    queryKey: ["entityImages", entityType, entityId] as const,
    queryFn: () => api.getAllEntityImages(entityType, entityId!),
    enabled: entityId != null && entityId > 0,
  });
}

export function useEntityImagesByType(entityType: string, entityId: number | null, imageType: string) {
  return useQuery({
    queryKey: ["entityImagesByType", entityType, entityId, imageType] as const,
    queryFn: () => api.getEntityImagesByType(entityType, entityId!, imageType),
    enabled: entityId != null && entityId > 0,
  });
}

export function useDeleteImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteImageById,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entityImages"] });
      qc.invalidateQueries({ queryKey: ["entityImagesByType"] });
      qc.invalidateQueries({ queryKey: ["imagePaths"] });
    },
  });
}

export function useReorderImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reorderEntityImages,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entityImages"] });
      qc.invalidateQueries({ queryKey: ["entityImagesByType"] });
    },
  });
}

export function useImagePaths(entityType: string, entityId: number, imageType: string) {
  return useQuery({
    queryKey: ["imagePaths", entityType, entityId, imageType] as const,
    queryFn: () => api.getImagePaths(entityType, entityId, imageType),
    enabled: entityId > 0,
    staleTime: 5 * 60_000, // images rarely change
  });
}

// ============================================================================
// Analysis hooks (single file)
// ============================================================================

export function useAnalyzeMediaFile() {
  return useMutation({
    mutationFn: api.analyzeMediaFile,
  });
}

// ============================================================================
// Drag & drop import hook
// ============================================================================

export function useImportDroppedPaths() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.importDroppedPaths,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.movies });
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
      qc.invalidateQueries({ queryKey: queryKeysInbox.count });
      qc.invalidateQueries({ queryKey: queryKeysInbox.items() });
    },
  });
}

// ============================================================================
// People hooks
// ============================================================================

export const queryKeysPeople = {
  all: ["people"] as const,
  detail: (id: number) => ["person", id] as const,
  moviePeople: (movieId: number) => ["moviePeople", movieId] as const,
};

export function usePeople() {
  return useQuery({ queryKey: queryKeysPeople.all, queryFn: api.getPeople });
}

export function useCreatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, primaryRole, tmdbId }: { name: string; primaryRole?: string; tmdbId?: number }) =>
      api.createPerson(name, primaryRole, tmdbId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeysPeople.all }),
  });
}

export function useDeletePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deletePerson,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeysPeople.all }),
  });
}

export function useMoviePeople(movieId: number) {
  return useQuery({
    queryKey: queryKeysPeople.moviePeople(movieId),
    queryFn: () => api.getMoviePeople(movieId),
    enabled: movieId > 0,
  });
}

export function usePerson(id: number) {
  return useQuery({
    queryKey: queryKeysPeople.detail(id),
    queryFn: () => api.getPerson(id),
    enabled: id > 0,
  });
}

export function usePersonMovies(personId: number) {
  return useQuery({
    queryKey: ["personMovies", personId] as const,
    queryFn: () => api.getPersonMovies(personId),
    enabled: personId > 0,
  });
}

export function useUpdatePerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, primaryRole, biography, notes }: {
      id: number; name?: string; primaryRole?: string; biography?: string; notes?: string;
    }) => api.updatePerson(id, name, primaryRole, biography, notes),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeysPeople.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeysPeople.all });
    },
  });
}

// ============================================================================
// Studios hooks
// ============================================================================

export const queryKeysStudios = {
  all: ["studios"] as const,
  detail: (id: number) => ["studio", id] as const,
  movieStudios: (movieId: number) => ["movieStudios", movieId] as const,
};

export function useStudios() {
  return useQuery({ queryKey: queryKeysStudios.all, queryFn: api.getStudios });
}

export function useCreateStudio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, country, tmdbId }: { name: string; country?: string; tmdbId?: number }) =>
      api.createStudio(name, country, tmdbId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeysStudios.all }),
  });
}

export function useDeleteStudio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteStudio,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeysStudios.all }),
  });
}

export function useStudioMovies(studioId: number) {
  return useQuery({
    queryKey: ["studioMovies", studioId] as const,
    queryFn: () => api.getStudioMovies(studioId),
    enabled: studioId > 0,
  });
}

export function useUpdateStudio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, country, description, notes }: {
      id: number; name?: string; country?: string; description?: string; notes?: string;
    }) => api.updateStudio(id, name, country, description, notes),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeysStudios.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeysStudios.all });
    },
  });
}

// ============================================================================
// Collections hooks
// ============================================================================

export const queryKeysCollections = {
  all: ["collections"] as const,
  items: (id: number) => ["collectionItems", id] as const,
};

export function useCollections() {
  return useQuery({ queryKey: queryKeysCollections.all, queryFn: api.getCollections });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      api.createCollection(name, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeysCollections.all }),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCollection,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeysCollections.all }),
  });
}

export function useCollectionItems(collectionId: number) {
  return useQuery({
    queryKey: queryKeysCollections.items(collectionId),
    queryFn: () => api.getCollectionItems(collectionId),
    enabled: collectionId > 0,
  });
}

export function useAddCollectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, movieId, seriesId }: { collectionId: number; movieId?: number; seriesId?: number }) =>
      api.addCollectionItem(collectionId, movieId, seriesId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeysCollections.all });
      qc.invalidateQueries({ queryKey: queryKeysCollections.items(variables.collectionId) });
    },
  });
}

export function useRemoveCollectionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { itemId: number; collectionId: number }) =>
      api.removeCollectionItem(vars.itemId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeysCollections.all });
      qc.invalidateQueries({ queryKey: queryKeysCollections.items(variables.collectionId) });
    },
  });
}

// ============================================================================
// Episodes hooks
// ============================================================================

export function useUpdateEpisode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, overview, runtime }: {
      id: number; title?: string; overview?: string; runtime?: number;
    }) => api.updateEpisode(id, title, overview, runtime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seriesList });
    },
  });
}

// ============================================================================
// Genres hooks
// ============================================================================

export function useGenres() {
  return useQuery({ queryKey: ["genres"] as const, queryFn: api.getGenres });
}

// ============================================================================
// Media Versions hooks
// ============================================================================

export function useMovieVersions(movieId: number | null) {
  return useQuery({
    queryKey: ["movieVersions", movieId] as const,
    queryFn: () => api.getMovieVersions(movieId!),
    enabled: movieId != null && movieId > 0,
  });
}

export function useVersionFiles(versionId: number | null) {
  return useQuery({
    queryKey: ["versionFiles", versionId] as const,
    queryFn: () => api.getVersionFiles(versionId!),
    enabled: versionId != null && versionId > 0,
  });
}

// ============================================================================
// Movie Genres hook
// ============================================================================

export function useMovieGenres(movieId: number) {
  return useQuery({
    queryKey: ["movieGenres", movieId] as const,
    queryFn: () => api.getMovieGenres(movieId),
    enabled: movieId > 0,
  });
}

// ============================================================================
// Dashboard Stats hooks
// ============================================================================

export function useDashboardStats() {
  return useQuery({ queryKey: ["dashboardStats"] as const, queryFn: api.getDashboardStats });
}

export function useGenreStats() {
  return useQuery({ queryKey: ["genreStats"] as const, queryFn: api.getGenreStats });
}

export function useRecentAdditions() {
  return useQuery({ queryKey: ["recentAdditions"] as const, queryFn: api.getRecentAdditions });
}

// ============================================================================
// FFprobe detection hook
// ============================================================================

export function useFfprobeStatus() {
  return useQuery({
    queryKey: ["ffprobeStatus"] as const,
    queryFn: api.checkFfprobe,
    staleTime: 5 * 60 * 1000, // Cache for 5 min — won't change often
    retry: false,
  });
}

// ============================================================================
// Similar Movies hook
// ============================================================================

export function useSimilarMovies(movieId: number | null) {
  return useQuery({
    queryKey: ["similarMovies", movieId] as const,
    queryFn: () => api.getSimilarMovies(movieId!),
    enabled: movieId != null && movieId > 0,
  });
}

// ============================================================================
// Duplicate Detection hooks
// ============================================================================

export function useExactDuplicates() {
  return useQuery({ queryKey: ["exactDuplicates"] as const, queryFn: api.findExactDuplicates });
}

export function useProbableDuplicates() {
  return useQuery({ queryKey: ["probableDuplicates"] as const, queryFn: api.findProbableDuplicates });
}

export function useMultiVersionMovies() {
  return useQuery({ queryKey: ["multiVersionMovies"] as const, queryFn: api.findMultiVersionMovies });
}

// ============================================================================
// Suggestions hooks
// ============================================================================

export function useRecentlyAddedMovies(limit?: number) {
  return useQuery({ queryKey: ["recentlyAdded", limit] as const, queryFn: () => api.getRecentlyAddedMovies(limit) });
}

export function useIncompleteSeries(limit?: number) {
  return useQuery({ queryKey: ["incompleteSeries", limit] as const, queryFn: () => api.getIncompleteSeries(limit) });
}

export function useWishlistMovies(limit?: number) {
  return useQuery({ queryKey: ["wishlist", limit] as const, queryFn: () => api.getWishlistMovies(limit) });
}

// ============================================================================
// Seed Demo Data
// ============================================================================

export function useSeedDemoData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.seedDemoData,
    onSuccess: () => {
      // Invalidate everything — all tables are populated
      qc.invalidateQueries();
    },
  });
}
