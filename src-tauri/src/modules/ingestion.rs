use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use super::filename_parser::{self, ParsedFilename};

/// A discovered video file with its parsed info
#[derive(Debug, Serialize, Deserialize)]
pub struct DiscoveredFile {
    pub path: PathBuf,
    pub size: u64,
    pub parsed: ParsedFilename,
    pub relative_path: String,
}

/// A scanned file ready for pipeline processing (with DB awareness)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedFile {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub parsed: ParsedFilename,
    pub is_new: bool,
}

impl DiscoveredFile {
    /// Convert to ScannedFile for pipeline processing
    pub fn to_scanned(&self, is_new: bool) -> ScannedFile {
        let file_name = self.path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("")
            .to_string();
        ScannedFile {
            file_path: self.path.to_string_lossy().to_string(),
            file_name,
            file_size: self.size,
            parsed: self.parsed.clone(),
            is_new,
        }
    }
}

/// Scan result classified by type
#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub movies: Vec<DiscoveredFile>,
    pub episodes: Vec<DiscoveredFile>,
    pub unrecognized: Vec<DiscoveredFile>,
    pub total_files: usize,
    pub total_size: u64,
}

/// Scan a directory for video files
pub fn scan_directory(root: &Path) -> Result<Vec<DiscoveredFile>> {
    let mut discovered = Vec::new();

    if !root.exists() {
        return Err(anyhow::anyhow!("Directory does not exist: {}", root.display()));
    }
    if !root.is_dir() {
        return Err(anyhow::anyhow!("Path is not a directory: {}", root.display()));
    }

    log::info!("Scanning directory: {}", root.display());

    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        if !path.is_file() || !filename_parser::is_video_file(path) {
            continue;
        }

        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

        // Skip very small files (< 10MB, probably samples)
        if size < 10 * 1024 * 1024 {
            continue;
        }

        let filename = path.file_name().and_then(|f| f.to_str()).unwrap_or("");
        let mut parsed = filename_parser::parse_filename(filename);

        // Enrich from directory structure (series/season folders)
        if parsed.season.is_none() {
            if let Some(rel_path) = path.strip_prefix(root).ok() {
                if let Some((series_name, season_num)) =
                    filename_parser::parse_series_directory(rel_path)
                {
                    if parsed.media_type != filename_parser::MediaType::Episode {
                        parsed.media_type = filename_parser::MediaType::Episode;
                        parsed.title = Some(series_name);
                        parsed.season = season_num;
                        parsed.confidence = 0.65;
                    } else if parsed.title.is_none() {
                        parsed.title = Some(series_name);
                    }
                }
            }
        }

        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string();

        discovered.push(DiscoveredFile {
            path: path.to_path_buf(),
            size,
            parsed,
            relative_path,
        });
    }

    log::info!("Scan complete: {} video files found", discovered.len());
    Ok(discovered)
}

/// Classify discovered files into movies, episodes, unrecognized
pub fn classify_discovered(files: Vec<DiscoveredFile>) -> ScanResult {
    let total_files = files.len();
    let total_size: u64 = files.iter().map(|f| f.size).sum();

    let mut movies = Vec::new();
    let mut episodes = Vec::new();
    let mut unrecognized = Vec::new();

    for file in files {
        match file.parsed.media_type {
            filename_parser::MediaType::Movie if file.parsed.confidence >= 0.5 => movies.push(file),
            filename_parser::MediaType::Episode if file.parsed.confidence >= 0.5 => episodes.push(file),
            _ => unrecognized.push(file),
        }
    }

    ScanResult {
        movies,
        episodes,
        unrecognized,
        total_files,
        total_size,
    }
}
