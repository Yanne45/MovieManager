//! NFO parser module (Kodi/Plex compatibility)
//!
//! Parses .nfo XML files to extract enriched metadata.
//! Supports both movie.nfo and tvshow.nfo formats.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

// ============================================================================
// Parsed NFO structures
// ============================================================================

/// Parsed movie NFO data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfoMovie {
    pub title: Option<String>,
    #[serde(rename = "originaltitle")]
    pub original_title: Option<String>,
    #[serde(rename = "sorttitle")]
    pub sort_title: Option<String>,
    pub year: Option<i64>,
    pub plot: Option<String>,
    pub outline: Option<String>,
    pub tagline: Option<String>,
    pub runtime: Option<i64>,
    pub mpaa: Option<String>,
    #[serde(default)]
    pub genre: Vec<String>,
    #[serde(default)]
    pub studio: Vec<String>,
    #[serde(default)]
    pub director: Vec<String>,
    #[serde(default)]
    pub actor: Vec<NfoActor>,
    #[serde(default, rename = "uniqueid")]
    pub unique_ids: Vec<NfoUniqueId>,
    // Thumb/fanart paths (relative)
    pub thumb: Option<String>,
    pub fanart: Option<NfoFanart>,
}

/// Parsed TV show NFO data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfoTvShow {
    pub title: Option<String>,
    #[serde(rename = "originaltitle")]
    pub original_title: Option<String>,
    pub plot: Option<String>,
    pub year: Option<i64>,
    pub status: Option<String>,
    #[serde(default)]
    pub genre: Vec<String>,
    #[serde(default)]
    pub studio: Vec<String>,
    #[serde(default)]
    pub actor: Vec<NfoActor>,
    #[serde(default, rename = "uniqueid")]
    pub unique_ids: Vec<NfoUniqueId>,
    pub thumb: Option<String>,
    pub season: Option<i64>,
    pub episode: Option<i64>,
}

/// Parsed episode NFO data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfoEpisode {
    pub title: Option<String>,
    pub plot: Option<String>,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub aired: Option<String>,
    pub runtime: Option<i64>,
    #[serde(default)]
    pub director: Vec<String>,
    #[serde(default)]
    pub actor: Vec<NfoActor>,
    #[serde(default, rename = "uniqueid")]
    pub unique_ids: Vec<NfoUniqueId>,
    pub thumb: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfoActor {
    pub name: Option<String>,
    pub role: Option<String>,
    pub order: Option<i64>,
    pub thumb: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfoUniqueId {
    #[serde(rename = "@type")]
    pub id_type: Option<String>,
    #[serde(rename = "@default")]
    pub default: Option<String>,
    #[serde(rename = "$text")]
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NfoFanart {
    pub thumb: Option<String>,
}

/// What type of NFO was parsed
#[derive(Debug, Clone, Serialize)]
pub enum NfoType {
    Movie(NfoMovie),
    TvShow(NfoTvShow),
    Episode(NfoEpisode),
}

/// Result of parsing an NFO file
#[derive(Debug, Clone, Serialize)]
pub struct NfoParseResult {
    pub file_path: String,
    pub nfo_type: String,
    pub title: Option<String>,
    pub year: Option<i64>,
    pub tmdb_id: Option<i64>,
    pub imdb_id: Option<String>,
    pub genres: Vec<String>,
    pub actors: Vec<NfoActorInfo>,
    pub directors: Vec<String>,
    pub studios: Vec<String>,
    pub overview: Option<String>,
    pub tagline: Option<String>,
    pub runtime: Option<i64>,
    pub original_title: Option<String>,
    pub sort_title: Option<String>,
    pub content_rating: Option<String>,
    // Episode-specific
    pub season_number: Option<i64>,
    pub episode_number: Option<i64>,
    pub air_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NfoActorInfo {
    pub name: String,
    pub role: Option<String>,
    pub order: Option<i64>,
}

// ============================================================================
// Parsing
// ============================================================================

/// Parse an NFO file and return structured data
pub fn parse_nfo_file(path: &Path) -> Result<NfoParseResult> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read NFO file: {}", path.display()))?;

    parse_nfo_content(&content, path)
}

/// Parse NFO XML content
fn parse_nfo_content(content: &str, source_path: &Path) -> Result<NfoParseResult> {
    let file_path = source_path.to_string_lossy().to_string();

    // Try movie first
    if let Ok(movie) = quick_xml::de::from_str::<NfoMovieWrapper>(content) {
        return Ok(movie_to_result(movie.0, file_path));
    }

    // Try tvshow
    if let Ok(tvshow) = quick_xml::de::from_str::<NfoTvShowWrapper>(content) {
        return Ok(tvshow_to_result(tvshow.0, file_path));
    }

    // Try episode
    if let Ok(episode) = quick_xml::de::from_str::<NfoEpisodeWrapper>(content) {
        return Ok(episode_to_result(episode.0, file_path));
    }

    anyhow::bail!("Could not parse NFO file as movie, tvshow, or episode: {}", source_path.display())
}

// Wrapper types for XML root elements
#[derive(Deserialize)]
#[serde(rename = "movie")]
struct NfoMovieWrapper(NfoMovie);

#[derive(Deserialize)]
#[serde(rename = "tvshow")]
struct NfoTvShowWrapper(NfoTvShow);

#[derive(Deserialize)]
#[serde(rename = "episodedetails")]
struct NfoEpisodeWrapper(NfoEpisode);

// ============================================================================
// Conversion helpers
// ============================================================================

fn extract_ids(unique_ids: &[NfoUniqueId]) -> (Option<i64>, Option<String>) {
    let mut tmdb_id = None;
    let mut imdb_id = None;

    for uid in unique_ids {
        let id_type = uid.id_type.as_deref().unwrap_or("").to_lowercase();
        let value = uid.value.as_deref().unwrap_or("");

        match id_type.as_str() {
            "tmdb" => tmdb_id = value.parse::<i64>().ok(),
            "imdb" => imdb_id = Some(value.to_string()),
            _ => {
                // Sometimes IMDB ID is stored without type attribute
                if value.starts_with("tt") {
                    imdb_id = Some(value.to_string());
                }
            }
        }
    }

    (tmdb_id, imdb_id)
}

fn actors_to_info(actors: &[NfoActor]) -> Vec<NfoActorInfo> {
    actors
        .iter()
        .filter_map(|a| {
            a.name.as_ref().map(|name| NfoActorInfo {
                name: name.clone(),
                role: a.role.clone(),
                order: a.order,
            })
        })
        .collect()
}

fn movie_to_result(m: NfoMovie, file_path: String) -> NfoParseResult {
    let (tmdb_id, imdb_id) = extract_ids(&m.unique_ids);
    NfoParseResult {
        file_path,
        nfo_type: "movie".into(),
        title: m.title,
        year: m.year,
        tmdb_id,
        imdb_id,
        genres: m.genre,
        actors: actors_to_info(&m.actor),
        directors: m.director,
        studios: m.studio,
        overview: m.plot.or(m.outline),
        tagline: m.tagline,
        runtime: m.runtime,
        original_title: m.original_title,
        sort_title: m.sort_title,
        content_rating: m.mpaa,
        season_number: None,
        episode_number: None,
        air_date: None,
    }
}

fn tvshow_to_result(s: NfoTvShow, file_path: String) -> NfoParseResult {
    let (tmdb_id, imdb_id) = extract_ids(&s.unique_ids);
    NfoParseResult {
        file_path,
        nfo_type: "tvshow".into(),
        title: s.title,
        year: s.year,
        tmdb_id,
        imdb_id,
        genres: s.genre,
        actors: actors_to_info(&s.actor),
        directors: vec![],
        studios: s.studio,
        overview: s.plot,
        tagline: None,
        runtime: None,
        original_title: s.original_title,
        sort_title: None,
        content_rating: None,
        season_number: None,
        episode_number: None,
        air_date: None,
    }
}

fn episode_to_result(e: NfoEpisode, file_path: String) -> NfoParseResult {
    let (tmdb_id, imdb_id) = extract_ids(&e.unique_ids);
    NfoParseResult {
        file_path,
        nfo_type: "episode".into(),
        title: e.title,
        year: None,
        tmdb_id,
        imdb_id,
        genres: vec![],
        actors: actors_to_info(&e.actor),
        directors: e.director,
        studios: vec![],
        overview: e.plot,
        tagline: None,
        runtime: e.runtime,
        original_title: None,
        sort_title: None,
        content_rating: None,
        season_number: e.season,
        episode_number: e.episode,
        air_date: e.aired,
    }
}

// ============================================================================
// Directory scanning for NFO files
// ============================================================================

/// Find all .nfo files in a directory (recursive)
pub fn find_nfo_files(root: &Path) -> Vec<std::path::PathBuf> {
    walkdir::WalkDir::new(root)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_type().is_file()
                && e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("nfo"))
                    .unwrap_or(false)
        })
        .map(|e| e.into_path())
        .collect()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_parse_movie_nfo() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<movie>
    <title>The Matrix</title>
    <originaltitle>The Matrix</originaltitle>
    <year>1999</year>
    <plot>A computer hacker learns about the true nature of reality.</plot>
    <tagline>Welcome to the real world</tagline>
    <runtime>136</runtime>
    <mpaa>R</mpaa>
    <genre>Action</genre>
    <genre>Science Fiction</genre>
    <director>Lana Wachowski</director>
    <director>Lilly Wachowski</director>
    <studio>Warner Bros. Pictures</studio>
    <actor>
        <name>Keanu Reeves</name>
        <role>Neo</role>
        <order>0</order>
    </actor>
    <actor>
        <name>Laurence Fishburne</name>
        <role>Morpheus</role>
        <order>1</order>
    </actor>
    <uniqueid type="imdb">tt0133093</uniqueid>
    <uniqueid type="tmdb">603</uniqueid>
</movie>"#;

        let result = parse_nfo_content(xml, &PathBuf::from("test.nfo")).unwrap();
        assert_eq!(result.nfo_type, "movie");
        assert_eq!(result.title.as_deref(), Some("The Matrix"));
        assert_eq!(result.year, Some(1999));
        assert_eq!(result.runtime, Some(136));
        assert_eq!(result.tmdb_id, Some(603));
        assert_eq!(result.imdb_id.as_deref(), Some("tt0133093"));
        assert_eq!(result.genres.len(), 2);
        assert_eq!(result.directors.len(), 2);
        assert_eq!(result.actors.len(), 2);
        assert_eq!(result.actors[0].name, "Keanu Reeves");
        assert_eq!(result.actors[0].role.as_deref(), Some("Neo"));
        assert_eq!(result.tagline.as_deref(), Some("Welcome to the real world"));
    }

    #[test]
    fn test_parse_tvshow_nfo() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<tvshow>
    <title>Breaking Bad</title>
    <year>2008</year>
    <plot>A chemistry teacher diagnosed with cancer turns to manufacturing meth.</plot>
    <genre>Drama</genre>
    <genre>Crime</genre>
    <studio>AMC</studio>
    <status>Ended</status>
    <uniqueid type="tmdb">1396</uniqueid>
</tvshow>"#;

        let result = parse_nfo_content(xml, &PathBuf::from("tvshow.nfo")).unwrap();
        assert_eq!(result.nfo_type, "tvshow");
        assert_eq!(result.title.as_deref(), Some("Breaking Bad"));
        assert_eq!(result.tmdb_id, Some(1396));
        assert_eq!(result.genres.len(), 2);
    }

    #[test]
    fn test_parse_episode_nfo() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
<episodedetails>
    <title>Pilot</title>
    <season>1</season>
    <episode>1</episode>
    <aired>2008-01-20</aired>
    <runtime>58</runtime>
    <plot>Walter White decides to start cooking meth.</plot>
    <director>Vince Gilligan</director>
</episodedetails>"#;

        let result = parse_nfo_content(xml, &PathBuf::from("S01E01.nfo")).unwrap();
        assert_eq!(result.nfo_type, "episode");
        assert_eq!(result.title.as_deref(), Some("Pilot"));
        assert_eq!(result.season_number, Some(1));
        assert_eq!(result.episode_number, Some(1));
        assert_eq!(result.air_date.as_deref(), Some("2008-01-20"));
    }
}
