use crate::db::queries;
use crate::modules::ingestion::{self, ScannedFile};
use crate::modules::pipeline::{self, ProcessingResult};
use crate::AppState;
use serde::Serialize;
use sqlx;
use tauri::State;

/// Scan result returned to the frontend
#[derive(Debug, Serialize)]
pub struct ScanCommandResult {
    pub library_id: i64,
    pub files_found: usize,
    pub movies: usize,
    pub episodes: usize,
    pub unrecognized: usize,
    pub total_size: u64,
}

/// Scan a library directory for video files
#[tauri::command]
pub async fn scan_library(
    state: State<'_, AppState>,
    library_id: i64,
) -> Result<ScanCommandResult, String> {
    let db = state.db();
    let pool = db.pool();

    let library = queries::get_library(pool, library_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Library {} not found", library_id))?;

    // Scan is synchronous (filesystem walk) — run in blocking thread
    let lib_path = library.path.clone();
    let discovered = tokio::task::spawn_blocking(move || {
        ingestion::scan_directory(std::path::Path::new(&lib_path))
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?
    .map_err(|e| format!("Scan error: {}", e))?;

    let classified = ingestion::classify_discovered(discovered);

    // Update library stats
    sqlx::query(
        "UPDATE libraries SET last_scan = datetime('now'), total_files = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(classified.total_files as i64)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(ScanCommandResult {
        library_id,
        files_found: classified.total_files,
        movies: classified.movies.len(),
        episodes: classified.episodes.len(),
        unrecognized: classified.unrecognized.len(),
        total_size: classified.total_size,
    })
}

/// Scan a library AND run TMDB matching on discovered files
#[tauri::command]
pub async fn scan_and_match_library(
    state: State<'_, AppState>,
    library_id: i64,
) -> Result<Vec<ProcessingResult>, String> {
    let db = state.db();
    let pool = db.pool();

    let library = queries::get_library(pool, library_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("Library {} not found", library_id))?;

    // Step 1: Scan (blocking filesystem walk)
    let lib_path = library.path.clone();
    let discovered = tokio::task::spawn_blocking(move || {
        ingestion::scan_directory(std::path::Path::new(&lib_path))
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?
    .map_err(|e| format!("Scan error: {}", e))?;

    let classified = ingestion::classify_discovered(discovered);

    // Update library stats
    sqlx::query(
        "UPDATE libraries SET last_scan = datetime('now'), total_files = ?, updated_at = datetime('now') WHERE id = ?"
    )
    .bind(classified.total_files as i64)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Step 2: Convert to ScannedFiles (check DB for existing files)
    let all_discovered: Vec<_> = classified.movies.into_iter()
        .chain(classified.episodes.into_iter())
        .chain(classified.unrecognized.into_iter())
        .collect();

    // Batch check: load all known file paths for this library in one query
    let known_paths: Vec<(String,)> = sqlx::query_as(
        "SELECT file_path FROM media_files WHERE library_id = ?"
    )
    .bind(library_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let known_set: std::collections::HashSet<String> = known_paths
        .into_iter()
        .map(|(p,)| p)
        .collect();

    let scanned_files: Vec<ScannedFile> = all_discovered
        .iter()
        .map(|file| {
            let file_path_str = file.path.to_string_lossy().to_string();
            let is_new = !known_set.contains(&file_path_str);
            file.to_scanned(is_new)
        })
        .collect();

    // Step 3: Match via TMDB
    let tmdb_client = state.get_tmdb();

    match tmdb_client {
        Some(client) => {
            let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();
            let results = pipeline::process_scanned_files(
                pool,
                library_id,
                &scanned_files,
                &client,
                Some(&cache),
            )
            .await
            .map_err(|e| e.to_string())?;

            Ok(results)
        }
        None => {
            log::warn!("No TMDB API key configured — files scanned but not matched");
            Ok(Vec::new())
        }
    }
}

/// Import files/folders dropped onto the window
/// Takes a list of paths (files or directories) and scans them
#[tauri::command]
pub async fn import_dropped_paths(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<ScanCommandResult, String> {
    use crate::modules::filename_parser::{self, MediaType};
    use crate::modules::ingestion;
    use std::path::Path;

    let db = state.db();
    let pool = db.pool();

    let mut total_found = 0usize;
    let mut movies = 0usize;
    let mut episodes = 0usize;
    let mut unrecognized = 0usize;
    let mut total_size = 0u64;

    // Collect all discovered files from all paths
    let mut all_discovered = Vec::new();

    for path_str in &paths {
        let path = Path::new(path_str);

        if path.is_dir() {
            match ingestion::scan_directory(path) {
                Ok(discovered) => all_discovered.extend(discovered),
                Err(e) => {
                    log::warn!("Failed to scan dropped directory {:?}: {}", path, e);
                    continue;
                }
            }
        } else if path.is_file() && filename_parser::is_video_file(path) {
            // Build a DiscoveredFile manually for a single file
            let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            let file_name = path.file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("");
            let parsed = filename_parser::parse_filename(file_name);
            all_discovered.push(ingestion::DiscoveredFile {
                path: path.to_path_buf(),
                size,
                parsed,
                relative_path: file_name.to_string(),
            });
        }
    }

    // Convert to ScannedFiles and insert into inbox
    for discovered in &all_discovered {
        let scanned = discovered.to_scanned(true);
        total_found += 1;
        total_size += scanned.file_size;

        match scanned.parsed.media_type {
            MediaType::Movie => movies += 1,
            MediaType::Episode => episodes += 1,
            MediaType::Unknown => unrecognized += 1,
        }

        // Insert into inbox as pending items for matching
        sqlx::query(
            "INSERT OR IGNORE INTO inbox_items (category, status, file_path, parsed_title, parsed_year, parsed_season, parsed_episode)
             VALUES ('unrecognized', 'pending', ?, ?, ?, ?, ?)"
        )
        .bind(&scanned.file_path)
        .bind(&scanned.parsed.title)
        .bind(&scanned.parsed.year)
        .bind(&scanned.parsed.season)
        .bind(if scanned.parsed.episodes.is_empty() { None } else {
            Some(scanned.parsed.episodes.iter().map(|e| e.to_string()).collect::<Vec<_>>().join(","))
        })
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(ScanCommandResult {
        library_id: 0, // no specific library for drops
        files_found: total_found,
        movies,
        episodes,
        unrecognized,
        total_size,
    })
}
