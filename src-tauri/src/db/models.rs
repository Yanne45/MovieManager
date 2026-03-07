use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

// ============================================================================
// Libraries
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Library {
    pub id: i64,
    pub name: String,
    pub path: String,
    #[sqlx(rename = "type")]
    pub lib_type: String,
    pub is_online: bool,
    pub last_scan: Option<NaiveDateTime>,
    pub total_files: i64,
    pub total_size: i64,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateLibrary {
    pub name: String,
    pub path: String,
    #[serde(default = "default_lib_type")]
    pub lib_type: String,
    pub notes: Option<String>,
}

fn default_lib_type() -> String {
    "hdd".to_string()
}

#[derive(Debug, Deserialize)]
pub struct UpdateLibrary {
    pub name: Option<String>,
    pub path: Option<String>,
    pub lib_type: Option<String>,
    pub is_online: Option<bool>,
    pub notes: Option<String>,
}

// ============================================================================
// Movies
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Movie {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub sort_title: Option<String>,
    pub overview: Option<String>,
    pub year: Option<i64>,
    pub release_date: Option<String>,
    pub runtime: Option<i64>,
    pub content_rating: Option<String>,
    pub tagline: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub owned: bool,
    pub is_placeholder: bool,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub primary_quality_score: Option<String>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateMovie {
    pub title: String,
    pub original_title: Option<String>,
    pub year: Option<i64>,
    pub runtime: Option<i64>,
    pub overview: Option<String>,
    pub owned: Option<bool>,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMovie {
    pub title: Option<String>,
    pub original_title: Option<String>,
    pub sort_title: Option<String>,
    pub overview: Option<String>,
    pub year: Option<i64>,
    pub runtime: Option<i64>,
    pub content_rating: Option<String>,
    pub tagline: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub owned: Option<bool>,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub primary_quality_score: Option<String>,
    pub notes: Option<String>,
}

// ============================================================================
// Series
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Series {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub sort_title: Option<String>,
    pub overview: Option<String>,
    pub first_air_date: Option<String>,
    pub last_air_date: Option<String>,
    pub status: String,
    pub total_seasons: Option<i64>,
    pub total_episodes: Option<i64>,
    pub content_rating: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub is_placeholder: bool,
    pub owned: bool,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub tvdb_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSeries {
    pub title: Option<String>,
    pub original_title: Option<String>,
    pub sort_title: Option<String>,
    pub overview: Option<String>,
    pub first_air_date: Option<String>,
    pub last_air_date: Option<String>,
    pub status: Option<String>,
    pub total_seasons: Option<i64>,
    pub total_episodes: Option<i64>,
    pub content_rating: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub owned: Option<bool>,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub tvdb_id: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Season {
    pub id: i64,
    pub series_id: i64,
    pub season_number: i64,
    pub title: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub episode_count: Option<i64>,
    pub poster_path: Option<String>,
    pub tmdb_id: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Episode {
    pub id: i64,
    pub series_id: i64,
    pub season_id: i64,
    pub episode_number: i64,
    pub absolute_number: Option<i64>,
    pub title: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub runtime: Option<i64>,
    pub has_file: bool,
    pub thumbnail_path: Option<String>,
    pub tmdb_id: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ============================================================================
// Media
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaVersion {
    pub id: i64,
    pub owner_type: String,
    pub owner_id: i64,
    pub label: Option<String>,
    pub quality_score: Option<String>,
    pub resolution: Option<String>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub audio_channels: Option<String>,
    pub video_bitrate: Option<i64>,
    pub audio_bitrate: Option<i64>,
    pub hdr_format: Option<String>,
    pub container: Option<String>,
    pub duration: Option<i64>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MediaFile {
    pub id: i64,
    pub media_version_id: i64,
    pub library_id: i64,
    pub file_path: String,
    pub file_name: String,
    pub file_size: Option<i64>,
    pub file_hash: Option<String>,
    pub last_seen: Option<NaiveDateTime>,
    pub is_available: bool,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ============================================================================
// People & Studios
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Person {
    pub id: i64,
    pub name: String,
    pub sort_name: Option<String>,
    pub primary_role: Option<String>,
    pub birth_date: Option<String>,
    pub birth_place: Option<String>,
    pub death_date: Option<String>,
    pub biography: Option<String>,
    pub photo_path: Option<String>,
    pub known_for: Option<String>,
    pub notes: Option<String>,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Studio {
    pub id: i64,
    pub name: String,
    pub logo_path: Option<String>,
    pub country: Option<String>,
    pub founded_date: Option<String>,
    pub description: Option<String>,
    pub notes: Option<String>,
    pub tmdb_id: Option<i64>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ============================================================================
// Tags & Genres
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub auto_generated: bool,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Genre {
    pub id: i64,
    pub name: String,
    pub tmdb_id: Option<i64>,
    pub created_at: NaiveDateTime,
}

// ============================================================================
// Collections
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub poster_path: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CollectionItemRow {
    pub id: i64,
    pub collection_id: i64,
    pub movie_id: Option<i64>,
    pub series_id: Option<i64>,
    pub position: i64,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
}

// ============================================================================
// System
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InboxItem {
    pub id: i64,
    pub category: String,
    pub status: String,
    pub file_path: Option<String>,
    pub parsed_title: Option<String>,
    pub parsed_year: Option<i64>,
    pub parsed_season: Option<i64>,
    pub parsed_episode: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<i64>,
    pub match_candidates: Option<String>,
    pub resolved_at: Option<NaiveDateTime>,
    pub resolution_note: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ============================================================================
// Query helpers (for listing with counts, joins, etc.)
// ============================================================================

/// Movie with genre names and tag names for table display
#[derive(Debug, Serialize)]
pub struct MovieListItem {
    #[serde(flatten)]
    pub movie: Movie,
    pub genres: Vec<String>,
    pub tags: Vec<String>,
    pub version_count: i64,
}

/// Series with completeness info for table display
#[derive(Debug, Serialize)]
pub struct SeriesListItem {
    #[serde(flatten)]
    pub series: Series,
    pub owned_episodes: i64,
    pub completeness_percent: f64,
}

/// Full series detail with seasons and episodes
#[derive(Debug, Serialize)]
pub struct SeriesDetail {
    #[serde(flatten)]
    pub series: Series,
    pub seasons: Vec<SeasonDetail>,
    pub owned_episodes: i64,
    pub total_episode_count: i64,
}

#[derive(Debug, Serialize)]
pub struct SeasonDetail {
    #[serde(flatten)]
    pub season: Season,
    pub episodes: Vec<Episode>,
    pub owned_count: i64,
}

// ============================================================================
// Junction query results
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MoviePersonRow {
    pub person_id: i64,
    pub name: String,
    pub primary_role: Option<String>,
    pub photo_path: Option<String>,
    pub tmdb_id: Option<i64>,
    pub role: String,
    pub character_name: Option<String>,
    pub credit_order: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MovieStudioRow {
    pub studio_id: i64,
    pub name: String,
    pub logo_path: Option<String>,
    pub country: Option<String>,
    pub tmdb_id: Option<i64>,
}

/// Collection with item count (for listing)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CollectionWithCount {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub poster_path: Option<String>,
    pub item_count: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

// ============================================================================
// Dashboard statistics
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DbStats {
    pub total_movies: i64,
    pub total_series: i64,
    pub total_episodes: i64,
    pub total_files: i64,
    pub total_size_bytes: i64,
    pub inbox_pending: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecentAddition {
    pub title: String,
    pub entity_type: String,
    pub created_at: NaiveDateTime,
}

// ============================================================================
// Similar movies
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SimilarMovie {
    pub id: i64,
    pub title: String,
    pub year: Option<i64>,
    pub poster_path: Option<String>,
    pub primary_quality_score: Option<String>,
    pub score: i64,
}

// ============================================================================
// Duplicate detection
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DuplicateGroup {
    pub match_key: String,
    pub match_type: String,
    pub file_count: i64,
    pub file_ids: String,
    pub file_names: String,
    pub total_size: i64,
}

// ============================================================================
// Export models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MovieExportRow {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub year: Option<i64>,
    pub runtime: Option<i64>,
    pub overview: Option<String>,
    pub content_rating: Option<String>,
    pub tagline: Option<String>,
    pub owned: bool,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub primary_quality_score: Option<String>,
    pub genres: Option<String>,
    pub directors: Option<String>,
    pub actors: Option<String>,
    pub studios: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SeriesExportRow {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub overview: Option<String>,
    pub first_air_date: Option<String>,
    pub last_air_date: Option<String>,
    pub status: Option<String>,
    pub total_seasons: Option<i64>,
    pub total_episodes: Option<i64>,
    pub tmdb_id: Option<i64>,
    pub genres: Option<String>,
    pub owned_episodes: i64,
    pub total_episode_records: i64,
}

// ============================================================================
// Suggestions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SuggestionItem {
    pub id: i64,
    pub title: String,
    pub entity_type: String,
    pub year: Option<i64>,
    pub poster_path: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct IncompleteSeriesRow {
    pub id: i64,
    pub title: String,
    pub poster_path: Option<String>,
    pub total_episodes: Option<i64>,
    pub owned_episodes: i64,
    pub missing_count: i64,
}
