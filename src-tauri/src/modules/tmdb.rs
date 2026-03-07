//! TMDB API provider module
//!
//! Handles all interactions with The Movie Database API (v3):
//! - Search movies/series by title+year
//! - Fetch full metadata (movie details, series/season/episode details)
//! - Matching logic with confidence scoring
//! - Image URL construction
//! - Mapping TMDB responses to local DB models

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};

// ============================================================================
// TMDB Client
// ============================================================================

const TMDB_BASE_URL: &str = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p";

/// Image size presets matching the cache multi-tailles spec
pub enum ImageSize {
    /// Thumbnail — for table rows (92px wide)
    Thumbnail,
    /// Medium — for detail panel (342px wide)
    Medium,
    /// Large — for gallery / full poster (500px wide)
    Large,
    /// Original — full resolution
    Original,
}

impl ImageSize {
    pub fn path_segment(&self) -> &str {
        match self {
            ImageSize::Thumbnail => "w92",
            ImageSize::Medium => "w342",
            ImageSize::Large => "w500",
            ImageSize::Original => "original",
        }
    }
}

/// Construct a full TMDB image URL
pub fn image_url(path: &str, size: ImageSize) -> String {
    format!("{}/{}{}", TMDB_IMAGE_BASE, size.path_segment(), path)
}

/// TMDB API client
#[derive(Clone)]
pub struct TmdbClient {
    http: Client,
    api_key: String,
    language: String,
}

impl TmdbClient {
    pub fn new(api_key: &str, language: &str) -> Self {
        Self {
            http: Client::new(),
            api_key: api_key.to_string(),
            language: language.to_string(),
        }
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    pub fn language(&self) -> &str {
        &self.language
    }

    /// Build a request URL with common query params
    fn url(&self, path: &str) -> String {
        let sep = if path.contains('?') { "&" } else { "?" };
        format!(
            "{}{}{}api_key={}&language={}",
            TMDB_BASE_URL, path, sep, self.api_key, self.language
        )
    }

    // ========================================================================
    // Movie endpoints
    // ========================================================================

    /// Search for movies by title, optionally filtered by year
    pub async fn search_movies(
        &self,
        query: &str,
        year: Option<i64>,
    ) -> Result<Vec<TmdbMovieSearchResult>> {
        let mut url = format!(
            "{}/search/movie?api_key={}&language={}&query={}",
            TMDB_BASE_URL, self.api_key, self.language,
            urlencoding::encode(query)
        );

        if let Some(y) = year {
            url.push_str(&format!("&year={}", y));
        }

        let resp: TmdbSearchResponse<TmdbMovieSearchResult> = self
            .http
            .get(&url)
            .send()
            .await
            .context("TMDB search_movies request failed")?
            .json()
            .await
            .context("TMDB search_movies parse failed")?;

        Ok(resp.results)
    }

    /// Fetch full movie details by TMDB ID
    pub async fn get_movie(&self, tmdb_id: i64) -> Result<TmdbMovieDetail> {
        let url = self.url(&format!(
            "/movie/{}?append_to_response=credits",
            tmdb_id
        ));

        let detail: TmdbMovieDetail = self
            .http
            .get(&url)
            .send()
            .await
            .context("TMDB get_movie request failed")?
            .json()
            .await
            .context("TMDB get_movie parse failed")?;

        Ok(detail)
    }

    // ========================================================================
    // Series endpoints
    // ========================================================================

    /// Search for TV series by title
    pub async fn search_series(
        &self,
        query: &str,
        year: Option<i64>,
    ) -> Result<Vec<TmdbSeriesSearchResult>> {
        let mut url = format!(
            "{}/search/tv?api_key={}&language={}&query={}",
            TMDB_BASE_URL, self.api_key, self.language,
            urlencoding::encode(query)
        );

        if let Some(y) = year {
            url.push_str(&format!("&first_air_date_year={}", y));
        }

        let resp: TmdbSearchResponse<TmdbSeriesSearchResult> = self
            .http
            .get(&url)
            .send()
            .await
            .context("TMDB search_series request failed")?
            .json()
            .await
            .context("TMDB search_series parse failed")?;

        Ok(resp.results)
    }

    /// Fetch full series details
    pub async fn get_series(&self, tmdb_id: i64) -> Result<TmdbSeriesDetail> {
        let url = self.url(&format!(
            "/tv/{}?append_to_response=credits",
            tmdb_id
        ));

        let detail: TmdbSeriesDetail = self
            .http
            .get(&url)
            .send()
            .await
            .context("TMDB get_series request failed")?
            .json()
            .await
            .context("TMDB get_series parse failed")?;

        Ok(detail)
    }

    /// Fetch season details (with all episodes)
    pub async fn get_season(
        &self,
        series_tmdb_id: i64,
        season_number: i64,
    ) -> Result<TmdbSeasonDetail> {
        let url = self.url(&format!(
            "/tv/{}/season/{}",
            series_tmdb_id, season_number
        ));

        let detail: TmdbSeasonDetail = self
            .http
            .get(&url)
            .send()
            .await
            .context("TMDB get_season request failed")?
            .json()
            .await
            .context("TMDB get_season parse failed")?;

        Ok(detail)
    }

    /// Fetch single episode details
    pub async fn get_episode(
        &self,
        series_tmdb_id: i64,
        season_number: i64,
        episode_number: i64,
    ) -> Result<TmdbEpisodeDetail> {
        let url = self.url(&format!(
            "/tv/{}/season/{}/episode/{}?append_to_response=credits",
            series_tmdb_id, season_number, episode_number
        ));

        let detail: TmdbEpisodeDetail = self
            .http
            .get(&url)
            .send()
            .await
            .context("TMDB get_episode request failed")?
            .json()
            .await
            .context("TMDB get_episode parse failed")?;

        Ok(detail)
    }
}

// ============================================================================
// TMDB Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct TmdbSearchResponse<T> {
    pub page: i64,
    pub results: Vec<T>,
    pub total_results: i64,
    pub total_pages: i64,
}

// ── Movie types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmdbMovieSearchResult {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub overview: Option<String>,
    pub release_date: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub genre_ids: Option<Vec<i64>>,
    pub popularity: Option<f64>,
    pub vote_average: Option<f64>,
    pub vote_count: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct TmdbMovieDetail {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub overview: Option<String>,
    pub release_date: Option<String>,
    pub runtime: Option<i64>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub tagline: Option<String>,
    pub status: Option<String>,
    pub imdb_id: Option<String>,
    pub genres: Option<Vec<TmdbGenre>>,
    pub production_companies: Option<Vec<TmdbCompany>>,
    pub credits: Option<TmdbCredits>,
}

// ── Series types ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmdbSeriesSearchResult {
    pub id: i64,
    pub name: String,
    pub original_name: Option<String>,
    pub overview: Option<String>,
    pub first_air_date: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub genre_ids: Option<Vec<i64>>,
    pub popularity: Option<f64>,
    pub vote_average: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TmdbSeriesDetail {
    pub id: i64,
    pub name: String,
    pub original_name: Option<String>,
    pub overview: Option<String>,
    pub first_air_date: Option<String>,
    pub last_air_date: Option<String>,
    pub status: Option<String>,
    pub number_of_seasons: Option<i64>,
    pub number_of_episodes: Option<i64>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub genres: Option<Vec<TmdbGenre>>,
    pub production_companies: Option<Vec<TmdbCompany>>,
    pub seasons: Option<Vec<TmdbSeasonSummary>>,
    pub created_by: Option<Vec<TmdbCreator>>,
    pub credits: Option<TmdbCredits>,
}

#[derive(Debug, Deserialize)]
pub struct TmdbSeasonSummary {
    pub id: i64,
    pub season_number: i64,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub episode_count: Option<i64>,
    pub poster_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TmdbSeasonDetail {
    pub id: i64,
    #[serde(rename = "_id")]
    pub internal_id: Option<String>,
    pub season_number: i64,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub poster_path: Option<String>,
    pub episodes: Option<Vec<TmdbEpisodeSummary>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TmdbEpisodeSummary {
    pub id: i64,
    pub episode_number: i64,
    pub season_number: i64,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub runtime: Option<i64>,
    pub still_path: Option<String>,
    pub vote_average: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct TmdbEpisodeDetail {
    pub id: i64,
    pub episode_number: i64,
    pub season_number: i64,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub runtime: Option<i64>,
    pub still_path: Option<String>,
    pub credits: Option<TmdbCredits>,
}

// ── Shared types ──

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TmdbGenre {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TmdbCompany {
    pub id: i64,
    pub name: String,
    pub logo_path: Option<String>,
    pub origin_country: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TmdbCredits {
    pub cast: Option<Vec<TmdbCastMember>>,
    pub crew: Option<Vec<TmdbCrewMember>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TmdbCastMember {
    pub id: i64,
    pub name: String,
    pub character: Option<String>,
    pub profile_path: Option<String>,
    pub order: Option<i64>,
    pub known_for_department: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TmdbCrewMember {
    pub id: i64,
    pub name: String,
    pub job: Option<String>,
    pub department: Option<String>,
    pub profile_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TmdbCreator {
    pub id: i64,
    pub name: String,
    pub profile_path: Option<String>,
}

// ============================================================================
// Matching logic
// ============================================================================

/// Result of matching a parsed filename against TMDB
#[derive(Debug, Clone, Serialize)]
pub struct MatchResult {
    pub tmdb_id: i64,
    pub title: String,
    pub year: Option<String>,
    pub confidence: u8,
    pub match_type: MatchType,
}

#[derive(Debug, Clone, Serialize)]
pub enum MatchType {
    ExactTitleYear,
    ExactTitle,
    FuzzyTitle,
    NoMatch,
}

/// Match a movie title+year against TMDB search results
pub fn match_movie(
    parsed_title: &str,
    parsed_year: Option<i64>,
    results: &[TmdbMovieSearchResult],
) -> Option<MatchResult> {
    if results.is_empty() {
        return None;
    }

    let normalized_title = normalize_for_match(parsed_title);

    let mut best: Option<MatchResult> = None;
    let mut best_score: u8 = 0;

    for r in results {
        let tmdb_title = normalize_for_match(&r.title);
        let tmdb_orig = r
            .original_title
            .as_deref()
            .map(normalize_for_match)
            .unwrap_or_default();

        let tmdb_year = r
            .release_date
            .as_deref()
            .and_then(|d| d.get(..4))
            .and_then(|y| y.parse::<i64>().ok());

        // Title comparison
        let title_match = tmdb_title == normalized_title || tmdb_orig == normalized_title;
        let title_contains = tmdb_title.contains(&normalized_title)
            || normalized_title.contains(&tmdb_title);

        // Year comparison (±1 tolerance)
        let year_match = match (parsed_year, tmdb_year) {
            (Some(py), Some(ty)) => (py as i32 - ty as i32).unsigned_abs() <= 1,
            _ => false,
        };
        let has_year = parsed_year.is_some();

        // Scoring
        let score = if title_match && year_match {
            95
        } else if title_match && !has_year {
            80
        } else if title_match {
            70 // title matches but year doesn't
        } else if title_contains && year_match {
            65
        } else if title_contains {
            45
        } else {
            // Levenshtein-like simple distance
            let dist = simple_distance(&normalized_title, &tmdb_title);
            if dist <= 2 && year_match {
                60
            } else if dist <= 2 {
                40
            } else if dist <= 4 && year_match {
                35
            } else {
                0
            }
        };

        if score > best_score {
            best_score = score;
            let match_type = if title_match && year_match {
                MatchType::ExactTitleYear
            } else if title_match {
                MatchType::ExactTitle
            } else if score > 0 {
                MatchType::FuzzyTitle
            } else {
                MatchType::NoMatch
            };

            best = Some(MatchResult {
                tmdb_id: r.id,
                title: r.title.clone(),
                year: r.release_date.clone(),
                confidence: score,
                match_type,
            });
        }
    }

    best.filter(|m| m.confidence > 0)
}

/// Match a series title against TMDB search results
pub fn match_series(
    parsed_title: &str,
    parsed_year: Option<i64>,
    results: &[TmdbSeriesSearchResult],
) -> Option<MatchResult> {
    if results.is_empty() {
        return None;
    }

    let normalized_title = normalize_for_match(parsed_title);

    let mut best: Option<MatchResult> = None;
    let mut best_score: u8 = 0;

    for r in results {
        let tmdb_title = normalize_for_match(&r.name);
        let tmdb_orig = r
            .original_name
            .as_deref()
            .map(normalize_for_match)
            .unwrap_or_default();

        let tmdb_year = r
            .first_air_date
            .as_deref()
            .and_then(|d| d.get(..4))
            .and_then(|y| y.parse::<i64>().ok());

        let title_match = tmdb_title == normalized_title || tmdb_orig == normalized_title;
        let title_contains = tmdb_title.contains(&normalized_title)
            || normalized_title.contains(&tmdb_title);

        let year_match = match (parsed_year, tmdb_year) {
            (Some(py), Some(ty)) => (py as i32 - ty as i32).unsigned_abs() <= 1,
            _ => false,
        };
        let has_year = parsed_year.is_some();

        let score = if title_match && year_match {
            95
        } else if title_match && !has_year {
            80
        } else if title_match {
            70
        } else if title_contains && year_match {
            65
        } else if title_contains {
            45
        } else {
            let dist = simple_distance(&normalized_title, &tmdb_title);
            if dist <= 2 && year_match { 60 }
            else if dist <= 2 { 40 }
            else if dist <= 4 && year_match { 35 }
            else { 0 }
        };

        if score > best_score {
            best_score = score;
            best = Some(MatchResult {
                tmdb_id: r.id,
                title: r.name.clone(),
                year: r.first_air_date.clone(),
                confidence: score,
                match_type: if title_match && year_match {
                    MatchType::ExactTitleYear
                } else if title_match {
                    MatchType::ExactTitle
                } else if score > 0 {
                    MatchType::FuzzyTitle
                } else {
                    MatchType::NoMatch
                },
            });
        }
    }

    best.filter(|m| m.confidence > 0)
}

// ============================================================================
// Helpers
// ============================================================================

/// Normalize a title for comparison: lowercase, remove articles, punctuation
fn normalize_for_match(title: &str) -> String {
    let lower = title.to_lowercase();
    let no_articles = lower
        .trim_start_matches("the ")
        .trim_start_matches("a ")
        .trim_start_matches("an ")
        .trim_start_matches("le ")
        .trim_start_matches("la ")
        .trim_start_matches("les ")
        .trim_start_matches("l'")
        .trim_start_matches("un ")
        .trim_start_matches("une ");

    no_articles
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == ' ')
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Simple character-level edit distance (capped for performance)
fn simple_distance(a: &str, b: &str) -> usize {
    if a == b {
        return 0;
    }
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let (la, lb) = (a_chars.len(), b_chars.len());

    // Bail on very different lengths
    if la.abs_diff(lb) > 5 {
        return la.abs_diff(lb);
    }

    // Simple Levenshtein
    let mut dp = vec![vec![0usize; lb + 1]; la + 1];
    for i in 0..=la {
        dp[i][0] = i;
    }
    for j in 0..=lb {
        dp[0][j] = j;
    }
    for i in 1..=la {
        for j in 1..=lb {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }
    dp[la][lb]
}

/// Map TMDB status string to our internal status enum
pub fn map_series_status(tmdb_status: &str) -> &'static str {
    match tmdb_status {
        "Returning Series" | "In Production" | "Planned" => "ongoing",
        "Ended" => "ended",
        "Canceled" | "Cancelled" => "cancelled",
        _ => "ongoing",
    }
}

// ============================================================================
// Tests
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize() {
        assert_eq!(normalize_for_match("The Dark Knight"), "dark knight");
        assert_eq!(normalize_for_match("L'Armée des ombres"), "armee des ombres");
        assert_eq!(normalize_for_match("  Blade Runner 2049 "), "blade runner 2049");
    }

    #[test]
    fn test_match_exact() {
        let results = vec![TmdbMovieSearchResult {
            id: 100,
            title: "Blade Runner 2049".into(),
            original_title: Some("Blade Runner 2049".into()),
            overview: None,
            release_date: Some("2017-10-04".into()),
            poster_path: None,
            backdrop_path: None,
            genre_ids: None,
            popularity: None,
            vote_average: None,
            vote_count: None,
        }];

        let m = match_movie("Blade Runner 2049", Some(2017), &results);
        assert!(m.is_some());
        let m = m.unwrap();
        assert_eq!(m.tmdb_id, 100);
        assert!(m.confidence >= 90);
    }

    #[test]
    fn test_match_no_year() {
        let results = vec![TmdbMovieSearchResult {
            id: 200,
            title: "Parasite".into(),
            original_title: Some("기생충".into()),
            overview: None,
            release_date: Some("2019-05-30".into()),
            poster_path: None,
            backdrop_path: None,
            genre_ids: None,
            popularity: None,
            vote_average: None,
            vote_count: None,
        }];

        let m = match_movie("Parasite", None, &results);
        assert!(m.is_some());
        assert!(m.unwrap().confidence >= 70);
    }

    #[test]
    fn test_no_match() {
        let results = vec![TmdbMovieSearchResult {
            id: 300,
            title: "Totally Different Movie".into(),
            original_title: None,
            overview: None,
            release_date: Some("2020-01-01".into()),
            poster_path: None,
            backdrop_path: None,
            genre_ids: None,
            popularity: None,
            vote_average: None,
            vote_count: None,
        }];

        let m = match_movie("Blade Runner 2049", Some(2017), &results);
        // Should either be None or very low confidence
        assert!(m.is_none() || m.unwrap().confidence < 30);
    }

    #[test]
    fn test_image_url() {
        let url = image_url("/abc123.jpg", ImageSize::Medium);
        assert_eq!(url, "https://image.tmdb.org/t/p/w342/abc123.jpg");
    }

    #[test]
    fn test_series_status_mapping() {
        assert_eq!(map_series_status("Returning Series"), "ongoing");
        assert_eq!(map_series_status("Ended"), "ended");
        assert_eq!(map_series_status("Canceled"), "cancelled");
    }

    #[test]
    fn test_simple_distance() {
        assert_eq!(simple_distance("kitten", "sitting"), 3);
        assert_eq!(simple_distance("same", "same"), 0);
    }
}
