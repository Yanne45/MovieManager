//! Media analysis module (FFprobe integration)
//!
//! - Runs ffprobe on a video file and parses the JSON output
//! - Extracts video streams (resolution, codec, bitrate, HDR)
//! - Extracts audio streams (codec, channels, bitrate, language)
//! - Extracts subtitle streams (language, format, forced)
//! - Computes a quality score (A/B/C/D) from technical metadata
//! - Updates media_versions with extracted technical data

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::Path;
use std::process::Command;

use crate::db::models::ScoreWeights;

// ============================================================================
// FFprobe execution
// ============================================================================

/// Raw ffprobe JSON output structure
#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    streams: Option<Vec<FfprobeStream>>,
    format: Option<FfprobeFormat>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    index: Option<i64>,
    codec_type: Option<String>,
    codec_name: Option<String>,
    codec_long_name: Option<String>,
    profile: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
    display_aspect_ratio: Option<String>,
    r_frame_rate: Option<String>,
    avg_frame_rate: Option<String>,
    bit_rate: Option<String>,
    sample_rate: Option<String>,
    channels: Option<i64>,
    channel_layout: Option<String>,
    bits_per_raw_sample: Option<String>,
    color_space: Option<String>,
    color_transfer: Option<String>,
    color_primaries: Option<String>,
    tags: Option<FfprobeTags>,
    disposition: Option<FfprobeDisposition>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    filename: Option<String>,
    format_name: Option<String>,
    format_long_name: Option<String>,
    duration: Option<String>,
    size: Option<String>,
    bit_rate: Option<String>,
    nb_streams: Option<i64>,
    tags: Option<FfprobeTags>,
}

#[derive(Debug, Deserialize)]
struct FfprobeTags {
    language: Option<String>,
    title: Option<String>,
    #[serde(rename = "BPS")]
    bps: Option<String>,
    #[serde(rename = "DURATION")]
    duration: Option<String>,
    handler_name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeDisposition {
    default: Option<i64>,
    forced: Option<i64>,
    hearing_impaired: Option<i64>,
}

/// Run ffprobe on a file and return parsed JSON
fn run_ffprobe(file_path: &Path) -> Result<FfprobeOutput> {
    let output = Command::new("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(file_path.as_os_str())
        .output()
        .context("Failed to execute ffprobe — is FFmpeg installed and in PATH?")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("ffprobe failed: {}", stderr));
    }

    let parsed: FfprobeOutput = serde_json::from_slice(&output.stdout)
        .context("Failed to parse ffprobe JSON output")?;

    Ok(parsed)
}

// ============================================================================
// Analyzed result types
// ============================================================================

/// Complete analysis result for a video file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAnalysis {
    /// File-level info
    pub file_path: String,
    pub container: String,
    pub duration_seconds: f64,
    pub total_bitrate: i64,
    pub file_size: i64,

    /// Primary video stream
    pub video: Option<VideoStream>,

    /// Audio streams (all tracks)
    pub audio_tracks: Vec<AudioStream>,

    /// Subtitle streams (all tracks)
    pub subtitle_tracks: Vec<SubtitleStream>,

    /// Computed quality score
    pub quality_score: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoStream {
    pub codec: String,
    pub codec_long: String,
    pub profile: Option<String>,
    pub width: i64,
    pub height: i64,
    pub resolution_label: String,
    pub aspect_ratio: Option<String>,
    pub frame_rate: Option<f64>,
    pub bitrate: i64,
    pub bit_depth: Option<i64>,
    pub hdr_format: Option<String>,
    pub color_space: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioStream {
    pub index: i64,
    pub codec: String,
    pub channels: i64,
    pub channel_layout: String,
    pub bitrate: i64,
    pub sample_rate: Option<i64>,
    pub language: Option<String>,
    pub title: Option<String>,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitleStream {
    pub index: i64,
    pub codec: String,
    pub language: Option<String>,
    pub title: Option<String>,
    pub is_default: bool,
    pub is_forced: bool,
    pub is_hearing_impaired: bool,
}

// ============================================================================
// Analysis logic
// ============================================================================

/// Analyze a video file with ffprobe
pub fn analyze_file(file_path: &Path) -> Result<MediaAnalysis> {
    let probe = run_ffprobe(file_path)?;

    let streams = probe.streams.unwrap_or_default();
    let format = probe.format.unwrap_or(FfprobeFormat {
        filename: None, format_name: None, format_long_name: None,
        duration: None, size: None, bit_rate: None, nb_streams: None, tags: None,
    });

    // Parse format-level info
    let container = format.format_name.unwrap_or_default();
    let duration_seconds = format.duration.as_deref()
        .and_then(|d| d.parse::<f64>().ok())
        .unwrap_or(0.0);
    let total_bitrate = format.bit_rate.as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .unwrap_or(0);
    let file_size = format.size.as_deref()
        .and_then(|s| s.parse::<i64>().ok())
        .unwrap_or(0);

    // ── Video streams ──
    let video = streams.iter()
        .find(|s| s.codec_type.as_deref() == Some("video"))
        .map(|s| {
            let width = s.width.unwrap_or(0);
            let height = s.height.unwrap_or(0);

            let bitrate = s.bit_rate.as_deref()
                .or(s.tags.as_ref().and_then(|t| t.bps.as_deref()))
                .and_then(|b| b.parse::<i64>().ok())
                .unwrap_or(0);

            let frame_rate = s.r_frame_rate.as_deref()
                .and_then(parse_frame_rate);

            let bit_depth = s.bits_per_raw_sample.as_deref()
                .and_then(|b| b.parse::<i64>().ok());

            let hdr_format = detect_hdr(
                s.color_transfer.as_deref(),
                s.color_primaries.as_deref(),
                s.color_space.as_deref(),
                bit_depth,
            );

            VideoStream {
                codec: normalize_video_codec(s.codec_name.as_deref().unwrap_or("unknown")),
                codec_long: s.codec_long_name.clone().unwrap_or_default(),
                profile: s.profile.clone(),
                width,
                height,
                resolution_label: resolution_label(width, height),
                aspect_ratio: s.display_aspect_ratio.clone(),
                frame_rate,
                bitrate,
                bit_depth,
                hdr_format,
                color_space: s.color_space.clone(),
            }
        });

    // ── Audio streams ──
    let audio_tracks: Vec<AudioStream> = streams.iter()
        .filter(|s| s.codec_type.as_deref() == Some("audio"))
        .map(|s| {
            let channels = s.channels.unwrap_or(2);
            AudioStream {
                index: s.index.unwrap_or(0),
                codec: normalize_audio_codec(s.codec_name.as_deref().unwrap_or("unknown")),
                channels,
                channel_layout: s.channel_layout.clone()
                    .unwrap_or_else(|| channel_layout_label(channels)),
                bitrate: s.bit_rate.as_deref()
                    .or(s.tags.as_ref().and_then(|t| t.bps.as_deref()))
                    .and_then(|b| b.parse::<i64>().ok())
                    .unwrap_or(0),
                sample_rate: s.sample_rate.as_deref()
                    .and_then(|r| r.parse::<i64>().ok()),
                language: s.tags.as_ref().and_then(|t| t.language.clone()),
                title: s.tags.as_ref().and_then(|t| t.title.clone()),
                is_default: s.disposition.as_ref()
                    .and_then(|d| d.default)
                    .map(|v| v == 1)
                    .unwrap_or(false),
            }
        })
        .collect();

    // ── Subtitle streams ──
    let subtitle_tracks: Vec<SubtitleStream> = streams.iter()
        .filter(|s| s.codec_type.as_deref() == Some("subtitle"))
        .map(|s| {
            SubtitleStream {
                index: s.index.unwrap_or(0),
                codec: s.codec_name.clone().unwrap_or_default(),
                language: s.tags.as_ref().and_then(|t| t.language.clone()),
                title: s.tags.as_ref().and_then(|t| t.title.clone()),
                is_default: s.disposition.as_ref()
                    .and_then(|d| d.default).map(|v| v == 1).unwrap_or(false),
                is_forced: s.disposition.as_ref()
                    .and_then(|d| d.forced).map(|v| v == 1).unwrap_or(false),
                is_hearing_impaired: s.disposition.as_ref()
                    .and_then(|d| d.hearing_impaired).map(|v| v == 1).unwrap_or(false),
            }
        })
        .collect();

    // ── Quality score ──
    let quality_score = compute_quality_score_with_weights(video.as_ref(), &audio_tracks, &ScoreWeights::default());

    Ok(MediaAnalysis {
        file_path: file_path.to_string_lossy().to_string(),
        container,
        duration_seconds,
        total_bitrate,
        file_size,
        video,
        audio_tracks,
        subtitle_tracks,
        quality_score,
    })
}

// ============================================================================
// Quality score computation
// ============================================================================

/// Compute quality score using configurable weights.
///
/// Each category's raw score is scaled to the user-configured max for that
/// category, then summed. Grade thresholds are fixed percentages of the total
/// max (A ≥ 71 %, B ≥ 48 %, C ≥ 29 %).
pub fn compute_quality_score_with_weights(
    video: Option<&VideoStream>,
    audio: &[AudioStream],
    weights: &ScoreWeights,
) -> String {
    let Some(v) = video else {
        return "D".to_string();
    };

    let height = v.height;

    // --- Resolution (raw 0-40, scaled to weights.resolution) ---
    let res_raw: i32 = match height {
        h if h >= 2160 => 40,
        h if h >= 1080 => 28,
        h if h >= 720  => 16,
        h if h >= 480  => 6,
        _              => 0,
    };
    let res_score = scale(res_raw, 40, weights.resolution);

    // --- Codec (raw 0-20, scaled to weights.codec) ---
    let codec = v.codec.to_uppercase();
    let codec_raw: i32 = match codec.as_str() {
        "HEVC" | "AV1"                        => 20,
        "VP9"                                  => 14,
        "H.264" | "AVC"                        => 12,
        "MPEG2" | "MPEG4" | "XVID" | "DIVX"   => 4,
        _                                      => 6,
    };
    let codec_score = scale(codec_raw, 20, weights.codec);

    // --- Bitrate (raw 0-20, scaled to weights.bitrate) ---
    let bitrate_kbps = v.bitrate / 1000;
    let bitrate_raw: i32 = if height >= 2160 {
        if bitrate_kbps >= 15_000 { 20 } else if bitrate_kbps >= 8_000 { 14 }
        else if bitrate_kbps >= 4_000 { 8 } else { 3 }
    } else if height >= 1080 {
        if bitrate_kbps >= 10_000 { 20 } else if bitrate_kbps >= 5_000 { 14 }
        else if bitrate_kbps >= 2_000 { 8 } else { 3 }
    } else if height >= 720 {
        if bitrate_kbps >= 5_000 { 18 } else if bitrate_kbps >= 2_000 { 12 } else { 5 }
    } else {
        if bitrate_kbps >= 2_000 { 12 } else { 3 }
    };
    let bitrate_score = scale(bitrate_raw, 20, weights.bitrate);

    // --- Audio channels (raw 0-15, scaled to weights.audio_channels) ---
    let best_audio = audio.iter().max_by_key(|a| a.channels);
    let (channels_raw, is_lossless) = if let Some(a) = best_audio {
        let ch: i32 = match a.channels {
            c if c >= 8 => 15,
            c if c >= 6 => 12,
            2            => 6,
            _            => 3,
        };
        let lossless = ["TRUEHD", "DTS-HD MA", "FLAC", "PCM", "LPCM"]
            .iter()
            .any(|c| a.codec.to_uppercase().contains(c));
        (ch, lossless)
    } else {
        (0, false)
    };
    let channels_score = scale(channels_raw, 15, weights.audio_channels);

    // --- Lossless audio bonus ---
    let lossless_score = if is_lossless { weights.audio_lossless } else { 0 };

    // --- HDR bonus ---
    let hdr_score = if v.hdr_format.is_some() { weights.hdr } else { 0 };

    let total = res_score + codec_score + bitrate_score + channels_score + lossless_score + hdr_score;
    let max_total = weights.resolution + weights.codec + weights.bitrate
        + weights.audio_channels + weights.audio_lossless + weights.hdr;

    grade_from_pct(total, max_total)
}

/// Legacy wrapper — uses default weights (for tests and backwards compat)
#[allow(dead_code)]
fn compute_quality_score(video: Option<&VideoStream>, audio: &[AudioStream]) -> String {
    compute_quality_score_with_weights(video, audio, &ScoreWeights::default())
}

/// Recompute a quality score from stored DB strings (no FFprobe needed).
///
/// Used by `recompute_all_scores` to update scores after the user changes weights.
pub fn compute_score_from_stored(
    resolution: Option<&str>,
    video_codec: Option<&str>,
    video_bitrate: Option<i64>,
    audio_codec: Option<&str>,
    audio_channels: Option<&str>,   // channel layout string: "5.1", "7.1", "Stereo"…
    has_hdr: bool,
    weights: &ScoreWeights,
) -> String {
    // --- Resolution ---
    let height = height_from_resolution_label(resolution.unwrap_or(""));
    let res_raw: i32 = match height {
        h if h >= 2160 => 40,
        h if h >= 1080 => 28,
        h if h >= 720  => 16,
        h if h >= 480  => 6,
        _              => 0,
    };
    let res_score = scale(res_raw, 40, weights.resolution);

    // --- Codec ---
    let codec = video_codec.unwrap_or("").to_uppercase();
    let codec_raw: i32 = match codec.as_str() {
        "HEVC" | "AV1"                        => 20,
        "VP9"                                  => 14,
        "H.264" | "AVC"                        => 12,
        "MPEG2" | "MPEG4" | "XVID" | "DIVX"   => 4,
        _                                      => 6,
    };
    let codec_score = scale(codec_raw, 20, weights.codec);

    // --- Bitrate ---
    let bitrate_kbps = video_bitrate.unwrap_or(0) / 1000;
    let bitrate_raw: i32 = if height >= 2160 {
        if bitrate_kbps >= 15_000 { 20 } else if bitrate_kbps >= 8_000 { 14 }
        else if bitrate_kbps >= 4_000 { 8 } else { 3 }
    } else if height >= 1080 {
        if bitrate_kbps >= 10_000 { 20 } else if bitrate_kbps >= 5_000 { 14 }
        else if bitrate_kbps >= 2_000 { 8 } else { 3 }
    } else if height >= 720 {
        if bitrate_kbps >= 5_000 { 18 } else if bitrate_kbps >= 2_000 { 12 } else { 5 }
    } else {
        if bitrate_kbps >= 2_000 { 12 } else { 3 }
    };
    let bitrate_score = scale(bitrate_raw, 20, weights.bitrate);

    // --- Audio channels ---
    let ch_count = channel_count_from_layout(audio_channels.unwrap_or(""));
    let channels_raw: i32 = match ch_count {
        c if c >= 8 => 15,
        c if c >= 6 => 12,
        2            => 6,
        _            => 3,
    };
    let channels_score = scale(channels_raw, 15, weights.audio_channels);

    // --- Lossless ---
    let ac = audio_codec.unwrap_or("").to_uppercase();
    let is_lossless = ["TRUEHD", "DTS-HD MA", "FLAC", "PCM", "LPCM"]
        .iter()
        .any(|c| ac.contains(c));
    let lossless_score = if is_lossless { weights.audio_lossless } else { 0 };

    // --- HDR ---
    let hdr_score = if has_hdr { weights.hdr } else { 0 };

    let total = res_score + codec_score + bitrate_score + channels_score + lossless_score + hdr_score;
    let max_total = weights.resolution + weights.codec + weights.bitrate
        + weights.audio_channels + weights.audio_lossless + weights.hdr;

    grade_from_pct(total, max_total)
}

/// Scale a raw score (0..raw_max) proportionally to user_max
#[inline]
fn scale(raw: i32, raw_max: i32, user_max: i32) -> i32 {
    if raw_max == 0 { return 0; }
    (raw as f64 / raw_max as f64 * user_max as f64).round() as i32
}

/// Convert total/max_total into a letter grade
#[inline]
fn grade_from_pct(total: i32, max_total: i32) -> String {
    if max_total == 0 { return "D".to_string(); }
    let pct = total * 100 / max_total;
    match pct {
        p if p >= 71 => "A".to_string(),
        p if p >= 48 => "B".to_string(),
        p if p >= 29 => "C".to_string(),
        _            => "D".to_string(),
    }
}

/// Map stored resolution label ("4K", "1080p" …) to pixel height
fn height_from_resolution_label(label: &str) -> i64 {
    match label {
        "4K" | "2160p" => 2160,
        "1440p"        => 1440,
        "1080p"        => 1080,
        "720p"         => 720,
        "480p"         => 480,
        _              => 0,
    }
}

/// Parse stored channel layout string to channel count
fn channel_count_from_layout(layout: &str) -> i64 {
    let l = layout.to_lowercase();
    if l.contains("7.1") { return 8; }
    if l.contains("5.1") { return 6; }
    if l == "stereo" || l == "2.0" { return 2; }
    if l == "mono" { return 1; }
    // fallback: try to parse the first number
    layout.split(|c: char| !c.is_numeric()).find_map(|s| s.parse::<i64>().ok()).unwrap_or(2)
}

// ============================================================================
// Helpers
// ============================================================================

/// Parse frame rate string like "24000/1001" or "24" to f64
fn parse_frame_rate(rate: &str) -> Option<f64> {
    if let Some((num, den)) = rate.split_once('/') {
        let n = num.parse::<f64>().ok()?;
        let d = den.parse::<f64>().ok()?;
        if d > 0.0 { Some(n / d) } else { None }
    } else {
        rate.parse::<f64>().ok()
    }
}

/// Map height to resolution label
fn resolution_label(width: i64, height: i64) -> String {
    match height {
        h if h >= 2160 => "4K".to_string(),
        h if h >= 1440 => "1440p".to_string(),
        h if h >= 1080 => "1080p".to_string(),
        h if h >= 720 => "720p".to_string(),
        h if h >= 480 => "480p".to_string(),
        _ => format!("{}x{}", width, height),
    }
}

/// Normalize video codec names
fn normalize_video_codec(codec: &str) -> String {
    match codec.to_lowercase().as_str() {
        "hevc" | "h265" => "HEVC".to_string(),
        "h264" | "avc" => "H.264".to_string(),
        "av1" => "AV1".to_string(),
        "vp9" => "VP9".to_string(),
        "mpeg2video" => "MPEG2".to_string(),
        "mpeg4" => "MPEG4".to_string(),
        other => other.to_uppercase(),
    }
}

/// Normalize audio codec names
fn normalize_audio_codec(codec: &str) -> String {
    match codec.to_lowercase().as_str() {
        "aac" => "AAC".to_string(),
        "ac3" => "AC3".to_string(),
        "eac3" => "EAC3".to_string(),
        "dts" => "DTS".to_string(),
        "truehd" => "TrueHD".to_string(),
        "flac" => "FLAC".to_string(),
        "pcm_s16le" | "pcm_s24le" | "pcm_s32le" => "PCM".to_string(),
        "opus" => "Opus".to_string(),
        "vorbis" => "Vorbis".to_string(),
        other => other.to_uppercase(),
    }
}

/// Channel count to layout label
fn channel_layout_label(channels: i64) -> String {
    match channels {
        1 => "Mono".to_string(),
        2 => "Stereo".to_string(),
        6 => "5.1".to_string(),
        8 => "7.1".to_string(),
        _ => format!("{} ch", channels),
    }
}

/// Detect HDR format from color metadata
fn detect_hdr(
    transfer: Option<&str>,
    primaries: Option<&str>,
    _space: Option<&str>,
    bit_depth: Option<i64>,
) -> Option<String> {
    let is_10bit = bit_depth.map(|b| b >= 10).unwrap_or(false);
    let transfer = transfer.unwrap_or("");
    let primaries = primaries.unwrap_or("");

    if transfer.contains("smpte2084") || transfer.contains("arib-std-b67") {
        if primaries.contains("bt2020") {
            // Could be HDR10, HDR10+, or Dolby Vision
            // (DV detection would need additional container-level parsing)
            if transfer.contains("arib-std-b67") {
                Some("HLG".to_string())
            } else {
                Some("HDR10".to_string())
            }
        } else {
            Some("HDR".to_string())
        }
    } else if is_10bit && primaries.contains("bt2020") {
        Some("HDR".to_string())
    } else {
        None
    }
}

// ============================================================================
// DB integration
// ============================================================================

/// Analyze a file and update its media_version in DB
pub async fn analyze_and_update(
    pool: &SqlitePool,
    media_version_id: i64,
    file_path: &str,
) -> Result<MediaAnalysis> {
    // Load user-configured score weights (fall back to defaults if not set)
    let weights: ScoreWeights = match crate::db::queries::get_setting(pool, "score_weights").await {
        Ok(Some(json)) => serde_json::from_str(&json).unwrap_or_default(),
        _ => ScoreWeights::default(),
    };

    let path = Path::new(file_path);
    let mut analysis = analyze_file(path)?;
    // Recompute with actual weights (analyze_file uses defaults internally)
    analysis.quality_score = compute_quality_score_with_weights(
        analysis.video.as_ref(),
        &analysis.audio_tracks,
        &weights,
    );

    // Update media_version with technical data
    if let Some(ref v) = analysis.video {
        sqlx::query(
            "UPDATE media_versions SET
                resolution = ?, video_codec = ?, video_bitrate = ?,
                audio_codec = ?, audio_channels = ?, audio_bitrate = ?,
                hdr_format = ?, container = ?,
                duration = ?, quality_score = ?,
                updated_at = datetime('now')
             WHERE id = ?"
        )
        .bind(&v.resolution_label)
        .bind(&v.codec)
        .bind(v.bitrate)
        .bind(analysis.audio_tracks.first().map(|a| a.codec.as_str()))
        .bind(analysis.audio_tracks.first().map(|a| &a.channel_layout))
        .bind(analysis.audio_tracks.first().map(|a| a.bitrate))
        .bind(&v.hdr_format)
        .bind(&analysis.container)
        .bind(analysis.duration_seconds as i64)
        .bind(&analysis.quality_score)
        .bind(media_version_id)
        .execute(pool)
        .await?;

        // Also update the parent entity's primary quality score
        let version: Option<(String, i64)> = sqlx::query_as(
            "SELECT owner_type, owner_id FROM media_versions WHERE id = ?"
        )
        .bind(media_version_id)
        .fetch_optional(pool)
        .await?;

        if let Some((owner_type, owner_id)) = version {
            let table = match owner_type.as_str() {
                "movie" => "movies",
                "episode" => "episodes",
                _ => "",
            };
            if !table.is_empty() && owner_type == "movie" {
                sqlx::query(&format!(
                    "UPDATE {} SET primary_quality_score = ?, updated_at = datetime('now') WHERE id = ?",
                    table
                ))
                .bind(&analysis.quality_score)
                .bind(owner_id)
                .execute(pool)
                .await?;
            }
        }
    }

    log::info!(
        "Analyzed '{}' → {} / {} / {} kbps / score {}",
        file_path,
        analysis.video.as_ref().map(|v| v.resolution_label.as_str()).unwrap_or("?"),
        analysis.video.as_ref().map(|v| v.codec.as_str()).unwrap_or("?"),
        analysis.total_bitrate / 1000,
        analysis.quality_score
    );

    Ok(analysis)
}

// ============================================================================
// Tests
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolution_label() {
        assert_eq!(resolution_label(3840, 2160), "4K");
        assert_eq!(resolution_label(1920, 1080), "1080p");
        assert_eq!(resolution_label(1280, 720), "720p");
        assert_eq!(resolution_label(720, 480), "480p");
        assert_eq!(resolution_label(320, 240), "320x240");
    }

    #[test]
    fn test_quality_score_4k_hevc() {
        let video = VideoStream {
            codec: "HEVC".into(), codec_long: String::new(), profile: None,
            width: 3840, height: 2160, resolution_label: "4K".into(),
            aspect_ratio: None, frame_rate: Some(24.0),
            bitrate: 18_000_000, bit_depth: Some(10),
            hdr_format: Some("HDR10".into()), color_space: None,
        };
        let audio = vec![AudioStream {
            index: 0, codec: "TrueHD".into(), channels: 8,
            channel_layout: "7.1".into(), bitrate: 4_000_000,
            sample_rate: Some(48000), language: Some("eng".into()),
            title: None, is_default: true,
        }];
        let score = compute_quality_score(Some(&video), &audio);
        assert_eq!(score, "A");
    }

    #[test]
    fn test_quality_score_1080p_h264() {
        let video = VideoStream {
            codec: "H.264".into(), codec_long: String::new(), profile: None,
            width: 1920, height: 1080, resolution_label: "1080p".into(),
            aspect_ratio: None, frame_rate: Some(24.0),
            bitrate: 8_000_000, bit_depth: Some(8),
            hdr_format: None, color_space: None,
        };
        let audio = vec![AudioStream {
            index: 0, codec: "DTS".into(), channels: 6,
            channel_layout: "5.1".into(), bitrate: 1_500_000,
            sample_rate: Some(48000), language: None,
            title: None, is_default: true,
        }];
        let score = compute_quality_score(Some(&video), &audio);
        assert_eq!(score, "B");
    }

    #[test]
    fn test_quality_score_sd() {
        let video = VideoStream {
            codec: "MPEG2".into(), codec_long: String::new(), profile: None,
            width: 720, height: 480, resolution_label: "480p".into(),
            aspect_ratio: None, frame_rate: Some(30.0),
            bitrate: 1_500_000, bit_depth: Some(8),
            hdr_format: None, color_space: None,
        };
        let audio = vec![AudioStream {
            index: 0, codec: "AC3".into(), channels: 2,
            channel_layout: "Stereo".into(), bitrate: 192_000,
            sample_rate: Some(48000), language: None,
            title: None, is_default: true,
        }];
        let score = compute_quality_score(Some(&video), &audio);
        assert_eq!(score, "D");
    }

    #[test]
    fn test_normalize_codecs() {
        assert_eq!(normalize_video_codec("hevc"), "HEVC");
        assert_eq!(normalize_video_codec("h264"), "H.264");
        assert_eq!(normalize_video_codec("av1"), "AV1");
        assert_eq!(normalize_audio_codec("truehd"), "TrueHD");
        assert_eq!(normalize_audio_codec("eac3"), "EAC3");
    }

    #[test]
    fn test_hdr_detection() {
        assert_eq!(
            detect_hdr(Some("smpte2084"), Some("bt2020"), None, Some(10)),
            Some("HDR10".to_string())
        );
        assert_eq!(
            detect_hdr(Some("arib-std-b67"), Some("bt2020"), None, Some(10)),
            Some("HLG".to_string())
        );
        assert_eq!(
            detect_hdr(Some("bt709"), Some("bt709"), None, Some(8)),
            None
        );
    }

    #[test]
    fn test_parse_frame_rate() {
        assert!((parse_frame_rate("24000/1001").unwrap() - 23.976).abs() < 0.01);
        assert_eq!(parse_frame_rate("24"), Some(24.0));
        assert_eq!(parse_frame_rate("0/0"), None);
    }
}

// ============================================================================
// FFprobe detection
// ============================================================================

/// Result of checking ffprobe availability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfprobeStatus {
    pub available: bool,
    pub version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Check if ffprobe is available in PATH and return its version
pub fn check_ffprobe() -> FfprobeStatus {
    // Try to find ffprobe
    match Command::new("ffprobe").arg("-version").output() {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                // Extract version from first line: "ffprobe version 6.1 ..."
                let version = stdout
                    .lines()
                    .next()
                    .and_then(|line| {
                        line.strip_prefix("ffprobe version ")
                            .map(|rest| rest.split_whitespace().next().unwrap_or("unknown").to_string())
                    });

                // Try to find the full path
                let path = find_binary_path("ffprobe");

                FfprobeStatus {
                    available: true,
                    version,
                    path,
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                FfprobeStatus {
                    available: false,
                    version: None,
                    path: None,
                    error: Some(format!("ffprobe exited with error: {}", stderr)),
                }
            }
        }
        Err(e) => FfprobeStatus {
            available: false,
            version: None,
            path: None,
            error: Some(format!("ffprobe not found: {}", e)),
        },
    }
}

/// Try to find the full path of a binary using `where` (Windows) or `which` (Unix)
fn find_binary_path(name: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    let cmd = "where";
    #[cfg(not(target_os = "windows"))]
    let cmd = "which";

    Command::new(cmd)
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}
