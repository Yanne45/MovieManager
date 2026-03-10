import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Database management
// ============================================================================

export interface DatabaseInfo {
  name: string;
  path: string;
}

export interface RecentDatabase {
  path: string;
  name: string;
  last_opened: string;
}

export const getCurrentDatabase = () => invoke<DatabaseInfo>("get_current_database");
export const getRecentDatabases = () => invoke<RecentDatabase[]>("get_recent_databases");
export const createDatabase = (path: string) =>
  invoke<DatabaseInfo>("create_database", { path });
export const openDatabase = (path: string) =>
  invoke<DatabaseInfo>("open_database", { path });

// ============================================================================
// Libraries
// ============================================================================

export interface Library {
  id: number;
  name: string;
  path: string;
  lib_type: string;
  is_online: boolean;
  last_scan: string | null;
  total_files: number;
  total_size: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const getLibraries = () => invoke<Library[]>("get_libraries");
export const createLibrary = (input: { name: string; path: string; lib_type?: string }) =>
  invoke<Library>("create_library", { input });
export const updateLibrary = (id: number, input: Partial<Library>) =>
  invoke<Library | null>("update_library", { id, input });
export const deleteLibrary = (id: number) => invoke<boolean>("delete_library", { id });

// ============================================================================
// Movies
// ============================================================================

export interface Movie {
  id: number;
  title: string;
  original_title: string | null;
  sort_title: string | null;
  overview: string | null;
  year: number | null;
  release_date: string | null;
  runtime: number | null;
  content_rating: string | null;
  tagline: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  owned: boolean;
  is_placeholder: boolean;
  tmdb_id: number | null;
  imdb_id: string | null;
  primary_quality_score: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const getMovies = () => invoke<Movie[]>("get_movies");
export const getMovieFileSizes = () => invoke<[number, number][]>("get_movie_file_sizes");
export const getMovie = (id: number) => invoke<Movie | null>("get_movie", { id });
export const createMovie = (input: { title: string; year?: number; runtime?: number }) =>
  invoke<Movie>("create_movie", { input });
export const updateMovie = (id: number, input: Partial<Movie>) =>
  invoke<Movie | null>("update_movie", { id, input });
export const deleteMovie = (id: number) => invoke<boolean>("delete_movie", { id });

// ============================================================================
// Series
// ============================================================================

export interface Series {
  id: number;
  title: string;
  original_title: string | null;
  sort_title: string | null;
  overview: string | null;
  first_air_date: string | null;
  last_air_date: string | null;
  status: string;
  total_seasons: number | null;
  total_episodes: number | null;
  content_rating: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  is_placeholder: boolean;
  owned: boolean;
  tmdb_id: number | null;
  imdb_id: string | null;
  tvdb_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeriesListItem extends Series {
  owned_episodes: number;
  completeness_percent: number;
}

export interface Episode {
  id: number;
  series_id: number;
  season_id: number;
  episode_number: number;
  absolute_number: number | null;
  title: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  has_file: boolean;
  thumbnail_path: string | null;
  tmdb_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: number;
  series_id: number;
  season_number: number;
  title: string | null;
  overview: string | null;
  air_date: string | null;
  episode_count: number | null;
  poster_path: string | null;
  tmdb_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonDetail extends Season {
  episodes: Episode[];
  owned_count: number;
}

export interface SeriesDetail extends Series {
  seasons: SeasonDetail[];
  owned_episodes: number;
  total_episode_count: number;
}

export const getSeriesList = () => invoke<SeriesListItem[]>("get_series_list");
export const getSeriesDetail = (id: number) =>
  invoke<SeriesDetail | null>("get_series_detail", { id });
export const updateSeries = (id: number, input: Partial<Series>) =>
  invoke<Series | null>("update_series", { id, input });

// ============================================================================
// Tags
// ============================================================================

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  auto_generated: boolean;
  created_at: string;
}

export const getTags = () => invoke<Tag[]>("get_tags");
export const createTag = (name: string, color?: string) =>
  invoke<Tag>("create_tag", { name, color });
export const deleteTag = (id: number) => invoke<boolean>("delete_tag", { id });

// ============================================================================
// Scan & Ingestion
// ============================================================================

export interface ScanResult {
  library_id: number;
  files_found: number;
  movies: number;
  episodes: number;
  unrecognized: number;
  total_size: number;
}

export interface ScannedFile {
  file_path: string;
  file_name: string;
  file_size: number;
  parsed: ParsedFilename;
  is_new: boolean;
}

export interface ParsedFilename {
  media_type: "Movie" | "Episode" | "Unknown";
  title: string | null;
  year: number | null;
  season: number | null;
  episodes: number[];
  quality: string | null;
  source: string | null;
  codec: string | null;
  audio: string | null;
  group: string | null;
  original: string;
  confidence: number;
}

export interface ProcessingResult {
  file_path: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  tmdb_id: number | null;
  confidence: number | null;
}

export const scanLibrary = (libraryId: number) =>
  invoke<ScanResult>("scan_library", { libraryId });
export const scanAndMatchLibrary = (libraryId: number) =>
  invoke<ProcessingResult[]>("scan_and_match_library", { libraryId });

// ============================================================================
// TMDB
// ============================================================================

export interface TmdbMovieSearchResult {
  id: number;
  title: string;
  original_title: string | null;
  overview: string | null;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number | null;
  vote_average: number | null;
}

export interface TmdbSeriesSearchResult {
  id: number;
  name: string;
  original_name: string | null;
  overview: string | null;
  first_air_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number | null;
}

export const searchMovieTmdb = (query: string, year?: number) =>
  invoke<TmdbMovieSearchResult[]>("search_movie_tmdb", { query, year });
export const searchSeriesTmdb = (query: string, year?: number) =>
  invoke<TmdbSeriesSearchResult[]>("search_series_tmdb", { query, year });
export const setTmdbApiKey = (apiKey: string, language?: string) =>
  invoke<void>("set_tmdb_api_key", { apiKey, language });

/** Construct a TMDB image URL */
export function tmdbImageUrl(
  path: string | null | undefined,
  size: "w92" | "w342" | "w500" | "original" = "w342"
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

// ============================================================================
// Media Analysis (FFprobe)
// ============================================================================

export interface MediaAnalysis {
  file_path: string;
  container: string;
  duration_seconds: number;
  total_bitrate: number;
  file_size: number;
  video: VideoStream | null;
  audio_tracks: AudioStream[];
  subtitle_tracks: SubtitleStream[];
  quality_score: string;
}

export interface VideoStream {
  codec: string;
  codec_long: string;
  profile: string | null;
  width: number;
  height: number;
  resolution_label: string;
  aspect_ratio: string | null;
  frame_rate: number | null;
  bitrate: number;
  bit_depth: number | null;
  hdr_format: string | null;
  color_space: string | null;
}

export interface AudioStream {
  index: number;
  codec: string;
  channels: number;
  channel_layout: string;
  bitrate: number;
  sample_rate: number | null;
  language: string | null;
  title: string | null;
  is_default: boolean;
}

export interface SubtitleStream {
  index: number;
  codec: string;
  language: string | null;
  title: string | null;
  is_default: boolean;
  is_forced: boolean;
  is_hearing_impaired: boolean;
}

export interface AnalyzeLibraryResult {
  total: number;
  analyzed: number;
  errors: number;
}

export const analyzeMediaFile = (mediaFileId: number) =>
  invoke<MediaAnalysis>("analyze_media_file", { mediaFileId });
export const analyzeMovieFiles = (movieId: number) =>
  invoke<MediaAnalysis[]>("analyze_movie_files", { movieId });
export const analyzeLibrary = (libraryId: number) =>
  invoke<AnalyzeLibraryResult>("analyze_library", { libraryId });

// ============================================================================
// Rules
// ============================================================================

export interface RuleCondition {
  field: string;
  operator: string;
  value: string;
}

export interface RuleAction {
  action_type: string;
  value: string;
}

export interface Rule {
  id: number;
  name: string;
  enabled: boolean;
  condition: RuleCondition;
  action: RuleAction;
  priority: number;
}

export interface RuleApplicationResult {
  entity_type: string;
  entity_id: number;
  rules_applied: { rule_id: number; rule_name: string; action_description: string }[];
}

export const getRules = () => invoke<Rule[]>("get_rules");
export const createRule = (
  name: string,
  condition: RuleCondition,
  action: RuleAction,
  priority?: number
) => invoke<number>("create_rule", { name, condition, action, priority });
export const toggleRule = (ruleId: number, enabled: boolean) =>
  invoke<void>("toggle_rule", { ruleId, enabled });
export const deleteRule = (ruleId: number) =>
  invoke<boolean>("delete_rule", { ruleId });
export const applyRulesLibrary = (libraryId: number) =>
  invoke<RuleApplicationResult[]>("apply_rules_library", { libraryId });

// ============================================================================
// History / Change log
// ============================================================================

export interface ChangeLogEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  field: string;
  old_value: string | null;
  new_value: string | null;
  source: string;
  timestamp: string;
}

export const getEntityHistory = (entityType: string, entityId: number) =>
  invoke<ChangeLogEntry[]>("get_entity_history", { entityType, entityId });
export const getRecentChanges = (limit?: number) =>
  invoke<ChangeLogEntry[]>("get_recent_changes", { limit });
export const rollbackChange = (changeId: number) =>
  invoke<ChangeLogEntry | null>("rollback_change", { changeId });

// ============================================================================
// Inbox
// ============================================================================

export interface InboxItem {
  id: number;
  category: string;
  status: string;
  file_path: string | null;
  parsed_title: string | null;
  parsed_year: number | null;
  parsed_season: number | null;
  parsed_episode: string | null;
  entity_type: string | null;
  entity_id: number | null;
  match_candidates: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export const getInboxItems = (status?: string) =>
  invoke<InboxItem[]>("get_inbox_items", { status });
export const getInboxCount = () => invoke<number>("get_inbox_count");
export const resolveInboxLink = (inboxId: number, entityType: string, entityId: number) =>
  invoke<void>("resolve_inbox_link", { inboxId, entityType, entityId });
export const resolveInboxIgnore = (inboxId: number) =>
  invoke<void>("resolve_inbox_ignore", { inboxId });
export const reopenInboxItem = (inboxId: number) =>
  invoke<void>("reopen_inbox_item", { inboxId });
export const deleteInboxItem = (inboxId: number) =>
  invoke<boolean>("delete_inbox_item", { inboxId });

// ============================================================================
// Images
// ============================================================================

export interface ImagePaths {
  thumbnail: string | null;
  medium: string | null;
  large: string | null;
}

export const getImagePaths = (entityType: string, entityId: number, imageType: string) =>
  invoke<ImagePaths | null>("get_image_paths", { entityType, entityId, imageType });
export const getImageCacheRoot = () => invoke<string>("get_image_cache_root");

export interface TmdbImageCandidate {
  tmdb_path: string;
  image_type: string;
  preview_url: string;
  width: number | null;
  height: number | null;
  vote_average: number | null;
}

export const importLocalImage = (
  entityType: string, entityId: number, imageType: string, sourcePath: string
) => invoke<ImagePaths>("import_local_image", { entityType, entityId, imageType, sourcePath });

export const applyTmdbImage = (
  entityType: string, entityId: number, imageType: string, tmdbPath: string
) => invoke<ImagePaths>("apply_tmdb_image", { entityType, entityId, imageType, tmdbPath });

export const deleteEntityImage = (
  entityType: string, entityId: number, imageType: string
) => invoke<void>("delete_entity_image", { entityType, entityId, imageType });

export const refreshEntityImages = (entityType: string, entityId: number) =>
  invoke<void>("refresh_entity_images", { entityType, entityId });

export const purgeOrphanedImages = () => invoke<number>("purge_orphaned_images");

export const getTmdbImageCandidates = (entityType: string, tmdbId: number) =>
  invoke<TmdbImageCandidate[]>("get_tmdb_image_candidates", { entityType, tmdbId });

// Multi-image support
export interface ImageRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  image_type: string;
  source_url: string | null;
  path_thumb: string | null;
  path_medium: string | null;
  path_large: string | null;
  position: number;
  entity_slug: string;
}

export const getAllEntityImages = (entityType: string, entityId: number) =>
  invoke<ImageRecord[]>("get_all_entity_images", { entityType, entityId });

export const getEntityImagesByType = (entityType: string, entityId: number, imageType: string) =>
  invoke<ImageRecord[]>("get_entity_images_by_type", { entityType, entityId, imageType });

export const deleteImageById = (imageId: number) =>
  invoke<void>("delete_image_by_id", { imageId });

export const reorderEntityImages = (imageIds: number[]) =>
  invoke<void>("reorder_entity_images", { imageIds });

// ============================================================================
// Drag & drop import
// ============================================================================

export const importDroppedPaths = (paths: string[]) =>
  invoke<ScanResult>("import_dropped_paths", { paths });

// ============================================================================
// People
// ============================================================================

export interface Person {
  id: number;
  name: string;
  sort_name: string | null;
  primary_role: string | null;
  birth_date: string | null;
  birth_place: string | null;
  death_date: string | null;
  biography: string | null;
  photo_path: string | null;
  known_for: string | null;
  notes: string | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoviePersonRow {
  person_id: number;
  name: string;
  primary_role: string | null;
  photo_path: string | null;
  tmdb_id: number | null;
  role: string;
  character_name: string | null;
  credit_order: number | null;
}

export const getPeople = () => invoke<Person[]>("get_people");
export const getPerson = (id: number) => invoke<Person | null>("get_person", { id });
export const createPerson = (name: string, primaryRole?: string, tmdbId?: number) =>
  invoke<Person>("create_person", { name, primaryRole, tmdbId });
export const updatePerson = (id: number, name?: string, primaryRole?: string, biography?: string, notes?: string) =>
  invoke<Person | null>("update_person", { id, name, primaryRole, biography, notes });
export const deletePerson = (id: number) => invoke<boolean>("delete_person", { id });
export const getMoviePeople = (movieId: number) => invoke<MoviePersonRow[]>("get_movie_people", { movieId });
export const addMoviePerson = (movieId: number, personId: number, role: string, characterName?: string, creditOrder?: number) =>
  invoke<void>("add_movie_person", { movieId, personId, role, characterName, creditOrder });
export const removeMoviePerson = (movieId: number, personId: number, role: string) =>
  invoke<void>("remove_movie_person", { movieId, personId, role });

export interface PersonMovieRow {
  movie_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  role: string;
  character_name: string | null;
}
export const getPersonMovies = (personId: number) =>
  invoke<PersonMovieRow[]>("get_person_movies", { personId });

// ============================================================================
// Studios
// ============================================================================

export interface StudioFull {
  id: number;
  name: string;
  logo_path: string | null;
  country: string | null;
  founded_date: string | null;
  description: string | null;
  notes: string | null;
  tmdb_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface MovieStudioRow {
  studio_id: number;
  name: string;
  logo_path: string | null;
  country: string | null;
  tmdb_id: number | null;
}

export const getStudios = () => invoke<StudioFull[]>("get_studios");
export const createStudio = (name: string, country?: string, tmdbId?: number) =>
  invoke<StudioFull>("create_studio", { name, country, tmdbId });
export const updateStudio = (id: number, name?: string, country?: string, description?: string, notes?: string) =>
  invoke<StudioFull | null>("update_studio", { id, name, country, description, notes });
export const deleteStudio = (id: number) => invoke<boolean>("delete_studio", { id });
export const getMovieStudios = (movieId: number) => invoke<MovieStudioRow[]>("get_movie_studios", { movieId });
export const addMovieStudio = (movieId: number, studioId: number) =>
  invoke<void>("add_movie_studio", { movieId, studioId });
export const removeMovieStudio = (movieId: number, studioId: number) =>
  invoke<void>("remove_movie_studio", { movieId, studioId });

export interface StudioMovieRow {
  movie_id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
}
export const getStudioMovies = (studioId: number) =>
  invoke<StudioMovieRow[]>("get_studio_movies", { studioId });

// ============================================================================
// Collections
// ============================================================================

export interface CollectionWithCount {
  id: number;
  name: string;
  description: string | null;
  poster_path: string | null;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionItemRow {
  id: number;
  collection_id: number;
  movie_id: number | null;
  series_id: number | null;
  position: number;
  notes: string | null;
  created_at: string;
}

export const getCollections = () => invoke<CollectionWithCount[]>("get_collections");
export const createCollection = (name: string, description?: string) =>
  invoke<CollectionWithCount>("create_collection", { name, description });
export const updateCollection = (id: number, name?: string, description?: string) =>
  invoke<CollectionWithCount | null>("update_collection", { id, name, description });
export const deleteCollection = (id: number) => invoke<boolean>("delete_collection", { id });
export const getCollectionItems = (collectionId: number) =>
  invoke<CollectionItemRow[]>("get_collection_items", { collectionId });
export const addCollectionItem = (collectionId: number, movieId?: number, seriesId?: number) =>
  invoke<void>("add_collection_item", { collectionId, movieId, seriesId });
export const removeCollectionItem = (itemId: number) => invoke<boolean>("remove_collection_item", { itemId });
export const reorderCollectionItem = (itemId: number, newPosition: number) =>
  invoke<void>("reorder_collection_item", { itemId, newPosition });

// ============================================================================
// Episodes (update)
// ============================================================================

export const updateEpisode = (id: number, title?: string, overview?: string, runtime?: number) =>
  invoke<Episode | null>("update_episode", { id, title, overview, runtime });

// ============================================================================
// Genres
// ============================================================================

export interface Genre {
  id: number;
  name: string;
  tmdb_id: number | null;
  created_at: string;
}

export const getGenres = () => invoke<Genre[]>("get_genres");
export const createGenre = (name: string, tmdbId?: number) =>
  invoke<Genre>("create_genre", { name, tmdbId });
export const getMovieGenres = (movieId: number) =>
  invoke<Genre[]>("get_movie_genres", { movieId });

// ============================================================================
// Media Versions & Files
// ============================================================================

export interface MediaVersion {
  id: number;
  owner_type: string;
  owner_id: number;
  label: string | null;
  quality_score: string | null;
  resolution: string | null;
  video_codec: string | null;
  audio_codec: string | null;
  audio_channels: string | null;
  video_bitrate: number | null;
  audio_bitrate: number | null;
  hdr_format: string | null;
  container: string | null;
  duration: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaFile {
  id: number;
  media_version_id: number;
  library_id: number;
  file_path: string;
  file_name: string;
  file_size: number | null;
  file_hash: string | null;
  last_seen: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export const getMovieVersions = (movieId: number) =>
  invoke<MediaVersion[]>("get_movie_versions", { movieId });
export const getVersionFiles = (versionId: number) =>
  invoke<MediaFile[]>("get_version_files", { versionId });

// ============================================================================
// Dashboard Stats
// ============================================================================

export interface DbStats {
  total_movies: number;
  total_series: number;
  total_episodes: number;
  total_files: number;
  total_size_bytes: number;
  inbox_pending: number;
}

export interface RecentAddition {
  title: string;
  entity_type: string;
  created_at: string;
}

export const getDashboardStats = () => invoke<DbStats>("get_dashboard_stats");
export const getGenreStats = () => invoke<[string, number][]>("get_genre_stats");
export const getRecentAdditions = () => invoke<RecentAddition[]>("get_recent_additions");

// ============================================================================
// FFprobe Detection
// ============================================================================

export interface FfprobeStatus {
  available: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

export const checkFfprobe = () => invoke<FfprobeStatus>("check_ffprobe");

// ============================================================================
// Backup / Export
// ============================================================================

export interface BackupResult {
  output_path: string;
  db_size_bytes: number;
  image_count: number;
  images_size_bytes: number;
  total_size_bytes: number;
}

export const createBackup = (outputPath: string) =>
  invoke<BackupResult>("create_backup", { outputPath });
export const getBackupFilename = () =>
  invoke<string>("get_backup_filename");

// ============================================================================
// NFO Import
// ============================================================================

export interface NfoParseResult {
  file_path: string;
  nfo_type: string;
  title: string | null;
  year: number | null;
  tmdb_id: number | null;
  imdb_id: string | null;
  genres: string[];
  actors: { name: string; role: string | null; order: number | null }[];
  directors: string[];
  studios: string[];
  overview: string | null;
  tagline: string | null;
  runtime: number | null;
  original_title: string | null;
  sort_title: string | null;
  content_rating: string | null;
  season_number: number | null;
  episode_number: number | null;
  air_date: string | null;
}

export interface NfoImportResult {
  total_files: number;
  movies_imported: number;
  series_imported: number;
  episodes_imported: number;
  errors: string[];
}

export const parseNfo = (path: string) =>
  invoke<NfoParseResult>("parse_nfo", { path });
export const scanNfoDirectory = (path: string) =>
  invoke<NfoParseResult[]>("scan_nfo_directory", { path });
export const importNfoFiles = (paths: string[]) =>
  invoke<NfoImportResult>("import_nfo_files", { paths });
export const importNfoDirectory = (path: string) =>
  invoke<NfoImportResult>("import_nfo_directory", { path });

// ============================================================================
// Similar Movies
// ============================================================================

export interface SimilarMovie {
  id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  primary_quality_score: string | null;
  score: number;
}

export const getSimilarMovies = (movieId: number, limit?: number) =>
  invoke<SimilarMovie[]>("get_similar_movies", { movieId, limit });

// ============================================================================
// Duplicate Detection
// ============================================================================

export interface DuplicateGroup {
  match_key: string;
  match_type: string;
  file_count: number;
  file_ids: string;
  file_names: string;
  total_size: number;
}

export const findExactDuplicates = () =>
  invoke<DuplicateGroup[]>("find_exact_duplicates");
export const findProbableDuplicates = () =>
  invoke<DuplicateGroup[]>("find_probable_duplicates");
export const findMultiVersionMovies = () =>
  invoke<DuplicateGroup[]>("find_multi_version_movies");

// ============================================================================
// Metadata Export
// ============================================================================

export interface ExportResult {
  output_path: string;
  movies_count: number;
  series_count: number;
  format: string;
}

export const exportJson = (outputPath: string) =>
  invoke<ExportResult>("export_json", { outputPath });
export const exportCsv = (outputDir: string) =>
  invoke<ExportResult>("export_csv", { outputDir });

// ============================================================================
// Suggestions
// ============================================================================

export interface SuggestionItem {
  id: number;
  title: string;
  entity_type: string;
  year: number | null;
  poster_path: string | null;
  created_at: string;
}

export interface IncompleteSeriesRow {
  id: number;
  title: string;
  poster_path: string | null;
  total_episodes: number | null;
  owned_episodes: number;
  missing_count: number;
}

export const getRecentlyAddedMovies = (limit?: number) =>
  invoke<SuggestionItem[]>("get_recently_added_movies", { limit });
export const getIncompleteSeries = (limit?: number) =>
  invoke<IncompleteSeriesRow[]>("get_incomplete_series", { limit });
export const getWishlistMovies = (limit?: number) =>
  invoke<SuggestionItem[]>("get_wishlist_movies", { limit });

// ============================================================================
// Seed Demo Data
// ============================================================================

export const seedDemoData = () => invoke<string>("seed_demo_data");

// ============================================================================
// Import screen
// ============================================================================

export interface ScannedFilePreview {
  file_path: string;
  file_name: string;
  file_size_mb: number;
  parsed_title: string | null;
  parsed_year: number | null;
  /** "movie" | "episode" | "unknown" */
  entity_type: string;
  /** 0–100 */
  confidence: number;
  quality: string | null;
  codec: string | null;
  is_duplicate: boolean;
  duplicate_title: string | null;
}

export interface ImportFileInput {
  file_path: string;
  title: string;
  year: number | null;
  /** "movie" | "series" */
  entity_type: string;
  tmdb_id: number | null;
}

export interface ImportFileResult {
  file_path: string;
  title: string;
  /** "imported" | "inbox" | "error" */
  status: string;
  error: string | null;
}

export const previewScanPaths = (paths: string[]) =>
  invoke<ScannedFilePreview[]>("preview_scan_paths", { paths });

export const importFiles = (files: ImportFileInput[]) =>
  invoke<ImportFileResult[]>("import_files", { files });
