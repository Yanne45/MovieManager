use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::LazyLock;

/// Result of parsing a video filename
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedFilename {
    /// Extracted title (cleaned up)
    pub title: Option<String>,
    /// Extracted year
    pub year: Option<i64>,
    /// Media type detected
    pub media_type: MediaType,
    /// Season number (for series)
    pub season: Option<i64>,
    /// Episode numbers (can be multiple for multi-episode files)
    pub episodes: Vec<i64>,
    /// Quality/resolution info found
    pub quality: Option<String>,
    /// Codec info found
    pub codec: Option<String>,
    /// Source info (BluRay, WEB-DL, etc.)
    pub source: Option<String>,
    /// Original filename for reference
    pub original_filename: String,
    /// Confidence score (0.0 - 1.0)
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MediaType {
    Movie,
    Episode,
    Unknown,
}

// ============================================================================
// Compiled regexes (lazy static)
// ============================================================================

// S01E01, S01E01E02, S01E01-E03
static RE_SXXEXX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[Ss](\d{1,2})[Ee](\d{1,3})(?:[Ee-](\d{1,3}))*").unwrap()
});

// 1x01, 1x01-03
static RE_NXNN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(\d{1,2})x(\d{1,3})(?:-(\d{1,3}))?").unwrap()
});

// Year (1920-2039)
static RE_YEAR: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\.\s\(\[]((?:19|20)\d{2})[\.\s\)\]]").unwrap()
});

// Standalone year at end
static RE_YEAR_END: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\.\s\(\[]?((?:19|20)\d{2})$").unwrap()
});

// Quality indicators
static RE_QUALITY: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(2160p|1080p|720p|480p|4K|UHD)").unwrap()
});

// Codec indicators
static RE_CODEC: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(x264|x265|h\.?264|h\.?265|HEVC|AV1|MPEG2|VP9|XviD|DivX)").unwrap()
});

// Source indicators
static RE_SOURCE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(BluRay|Blu-Ray|BDRip|BRRip|WEB-DL|WEBRip|WEB|HDRip|DVDRip|HDTV|PDTV|Remux)").unwrap()
});

// Separators to clean
static RE_SEPARATORS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[\.\-_]+").unwrap()
});

// Noise at end of title (group names, tags)
static RE_NOISE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\[.*?\]|\(.*?\)").unwrap()
});

// ============================================================================
// Video file extensions
// ============================================================================

pub const VIDEO_EXTENSIONS: &[&str] = &[
    "mkv", "mp4", "avi", "m4v", "mov", "wmv", "flv", "webm",
    "mpg", "mpeg", "m2ts", "ts", "vob", "divx", "ogm", "rmvb",
];

pub fn is_video_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| VIDEO_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

// ============================================================================
// Main parse function
// ============================================================================

pub fn parse_filename(filename: &str) -> ParsedFilename {
    let stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);

    let mut result = ParsedFilename {
        title: None,
        year: None,
        media_type: MediaType::Unknown,
        season: None,
        episodes: Vec::new(),
        quality: None,
        codec: None,
        source: None,
        original_filename: filename.to_string(),
        confidence: 0.0,
    };

    // 1. Extract quality, codec, source (before title cleaning)
    result.quality = RE_QUALITY.find(stem).map(|m| m.as_str().to_string());
    result.codec = RE_CODEC.find(stem).map(|m| m.as_str().to_string());
    result.source = RE_SOURCE.find(stem).map(|m| m.as_str().to_string());

    // 2. Try to detect series pattern (SxxExx)
    if let Some(caps) = RE_SXXEXX.captures(stem) {
        result.media_type = MediaType::Episode;
        result.season = caps.get(1).and_then(|m| m.as_str().parse().ok());
        result.confidence = 0.9;

        // First episode
        if let Some(ep) = caps.get(2).and_then(|m| m.as_str().parse().ok()) {
            result.episodes.push(ep);
        }
        // Multi-episode: collect additional episode numbers
        // Re-parse with a more thorough multi-episode regex
        let multi_re = Regex::new(r"(?i)[Ee](\d{1,3})").unwrap();
        let season_match = RE_SXXEXX.find(stem).unwrap();
        let episode_part = &stem[season_match.start()..season_match.end()];
        let mut eps: Vec<i64> = multi_re
            .captures_iter(episode_part)
            .filter_map(|c| c.get(1).and_then(|m| m.as_str().parse().ok()))
            .collect();
        // Also check for range pattern E01-E03 after the match
        if eps.len() >= 2 {
            let first = eps[0];
            let last = *eps.last().unwrap();
            if last > first && last - first <= 5 {
                eps = (first..=last).collect();
            }
        }
        if !eps.is_empty() {
            result.episodes = eps;
        }

        // Title is everything before the SxxExx pattern
        let title_end = season_match.start();
        result.title = Some(clean_title(&stem[..title_end]));
    }
    // 3. Try NxNN pattern
    else if let Some(caps) = RE_NXNN.captures(stem) {
        result.media_type = MediaType::Episode;
        result.season = caps.get(1).and_then(|m| m.as_str().parse().ok());
        result.confidence = 0.75;

        if let Some(ep) = caps.get(2).and_then(|m| m.as_str().parse().ok()) {
            result.episodes.push(ep);
        }
        if let Some(ep2) = caps.get(3).and_then(|m| m.as_str().parse().ok()) {
            let first = result.episodes[0];
            result.episodes = (first..=ep2).collect();
        }

        let nxnn_match = RE_NXNN.find(stem).unwrap();
        result.title = Some(clean_title(&stem[..nxnn_match.start()]));
    }
    // 4. It's a movie
    else {
        result.media_type = MediaType::Movie;
        result.confidence = 0.6;
    }

    // 5. Extract year
    if let Some(caps) = RE_YEAR.captures(stem) {
        result.year = caps.get(1).and_then(|m| m.as_str().parse().ok());
        result.confidence += 0.15;
    } else if let Some(caps) = RE_YEAR_END.captures(stem) {
        result.year = caps.get(1).and_then(|m| m.as_str().parse().ok());
        result.confidence += 0.1;
    }

    // 6. For movies, extract title (everything before year or quality markers)
    if result.media_type == MediaType::Movie {
        let title_str = stem;

        // Find the earliest position of year, quality, codec, or source
        let mut cut_pos = title_str.len();
        for re in [&*RE_YEAR, &*RE_QUALITY, &*RE_CODEC, &*RE_SOURCE] {
            if let Some(m) = re.find(title_str) {
                cut_pos = cut_pos.min(m.start());
            }
        }

        result.title = Some(clean_title(&title_str[..cut_pos]));
    }

    // 7. Validate and adjust confidence
    if result.title.as_ref().is_some_and(|t| t.is_empty()) {
        result.title = None;
        result.confidence *= 0.3;
    }

    // Boost confidence if we have both title and year
    if result.title.is_some() && result.year.is_some() {
        result.confidence = (result.confidence + 0.1).min(1.0);
    }

    result
}

/// Clean a raw title string: replace separators with spaces, trim, title case
fn clean_title(raw: &str) -> String {
    let cleaned = RE_NOISE.replace_all(raw, "");
    let cleaned = RE_SEPARATORS.replace_all(&cleaned, " ");
    cleaned.trim().to_string()
}

// ============================================================================
// Directory structure parsing (Series/Season folders)
// ============================================================================

/// Try to extract series info from directory structure
/// e.g. "Breaking Bad/Season 1/episode.mkv" or "Breaking.Bad.S01/"
pub fn parse_series_directory(path: &Path) -> Option<(String, Option<i64>)> {
    let components: Vec<&str> = path
        .components()
        .filter_map(|c| c.as_os_str().to_str())
        .collect();

    if components.len() < 2 {
        return None;
    }

    // Season folder patterns
    let season_re = Regex::new(r"(?i)^(?:season|saison|s)\s*(\d{1,2})$").unwrap();

    // Walk from deepest to shallowest
    for i in (0..components.len()).rev() {
        if let Some(caps) = season_re.captures(components[i]) {
            let season_num: i64 = caps.get(1)?.as_str().parse().ok()?;
            // Parent folder is the series name
            if i > 0 {
                let series_name = clean_title(components[i - 1]);
                return Some((series_name, Some(season_num)));
            }
        }
    }

    None
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_movie_simple() {
        let r = parse_filename("Blade.Runner.2049.2017.2160p.UHD.BluRay.HEVC.mkv");
        assert_eq!(r.media_type, MediaType::Movie);
        assert_eq!(r.title.as_deref(), Some("Blade Runner 2049"));
        assert_eq!(r.year, Some(2017));
        assert_eq!(r.quality.as_deref(), Some("2160p"));
        assert_eq!(r.codec.as_deref(), Some("HEVC"));
    }

    #[test]
    fn test_movie_with_parens() {
        let r = parse_filename("The Dark Knight (2008) 1080p BluRay.mkv");
        assert_eq!(r.media_type, MediaType::Movie);
        assert_eq!(r.year, Some(2008));
    }

    #[test]
    fn test_series_sxxexx() {
        let r = parse_filename("Breaking.Bad.S01E01.Pilot.720p.BluRay.mkv");
        assert_eq!(r.media_type, MediaType::Episode);
        assert_eq!(r.title.as_deref(), Some("Breaking Bad"));
        assert_eq!(r.season, Some(1));
        assert_eq!(r.episodes, vec![1]);
    }

    #[test]
    fn test_series_multi_episode() {
        let r = parse_filename("Breaking.Bad.S01E01E02.720p.mkv");
        assert_eq!(r.media_type, MediaType::Episode);
        assert_eq!(r.season, Some(1));
        assert!(r.episodes.contains(&1));
        assert!(r.episodes.contains(&2));
    }

    #[test]
    fn test_series_nxnn() {
        let r = parse_filename("Breaking Bad 1x01 Pilot.mkv");
        assert_eq!(r.media_type, MediaType::Episode);
        assert_eq!(r.season, Some(1));
        assert_eq!(r.episodes, vec![1]);
    }

    #[test]
    fn test_special_s00() {
        let r = parse_filename("Breaking.Bad.S00E01.Special.mkv");
        assert_eq!(r.media_type, MediaType::Episode);
        assert_eq!(r.season, Some(0));
        assert_eq!(r.episodes, vec![1]);
    }

    #[test]
    fn test_video_extensions() {
        assert!(is_video_file(Path::new("movie.mkv")));
        assert!(is_video_file(Path::new("movie.MP4")));
        assert!(!is_video_file(Path::new("subtitle.srt")));
        assert!(!is_video_file(Path::new("readme.txt")));
    }

    #[test]
    fn test_unrecognized() {
        let r = parse_filename("random_file.mkv");
        assert_eq!(r.media_type, MediaType::Movie); // defaults to movie
        assert!(r.confidence < 0.7);
    }
}
