use crate::db::queries;
use crate::modules::ingestion::{self, ScannedFile};
use crate::modules::pipeline::{self, ProcessingResult};
use crate::AppState;
use serde::{Deserialize, Serialize};
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

// ============================================================================
// Import screen — preview + commit
// ============================================================================

/// Preview info for a scanned file (no DB writes)
#[derive(Debug, Serialize)]
pub struct ScannedFilePreview {
    pub file_path: String,
    pub file_name: String,
    pub file_size_mb: f64,
    /// Title cleaned by the filename parser
    pub parsed_title: Option<String>,
    pub parsed_year: Option<i64>,
    /// "movie", "episode", or "unknown"
    pub entity_type: String,
    /// Parser confidence 0–100
    pub confidence: u8,
    pub quality: Option<String>,
    pub codec: Option<String>,
    /// true if this exact file path is already in media_files
    pub is_duplicate: bool,
    /// Title of the existing movie/series if duplicate
    pub duplicate_title: Option<String>,
}

/// One file the user wants to import (after editing in the preview table)
#[derive(Debug, Deserialize)]
pub struct ImportFileInput {
    pub file_path: String,
    pub title: String,
    pub year: Option<i64>,
    /// "movie" or "series"
    pub entity_type: String,
    /// TMDB id validated by the user — if provided, full metadata fetch happens
    pub tmdb_id: Option<i64>,
}

/// Result for one imported file
#[derive(Debug, Serialize)]
pub struct ImportFileResult {
    pub file_path: String,
    pub title: String,
    /// "imported", "inbox", or "error"
    pub status: String,
    pub error: Option<String>,
}

/// Preview a set of paths without writing to the database.
/// Paths can be individual video files or directories (scanned recursively).
#[tauri::command]
pub async fn preview_scan_paths(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<Vec<ScannedFilePreview>, String> {
    use crate::modules::filename_parser::{self, MediaType};
    use crate::modules::ingestion;
    use std::path::Path;

    let db = state.db();
    let pool = db.pool();

    // Collect all discovered files
    let mut all_discovered = Vec::new();
    for path_str in &paths {
        let path = Path::new(path_str);
        if path.is_dir() {
            match ingestion::scan_directory(path) {
                Ok(files) => all_discovered.extend(files),
                Err(e) => log::warn!("Failed to scan {:?}: {}", path, e),
            }
        } else if path.is_file() && filename_parser::is_video_file(path) {
            let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
            let file_name = path.file_name().and_then(|f| f.to_str()).unwrap_or("").to_string();
            let parsed = filename_parser::parse_filename(&file_name);
            all_discovered.push(ingestion::DiscoveredFile {
                path: path.to_path_buf(),
                size,
                parsed,
                relative_path: file_name,
            });
        }
    }

    if all_discovered.is_empty() {
        return Ok(Vec::new());
    }

    // Batch-check which paths are already in media_files
    let all_paths: Vec<String> = all_discovered
        .iter()
        .map(|f| f.path.to_string_lossy().to_string())
        .collect();

    // Build a map of known file_path → movie/series title
    let known_rows: Vec<(String, Option<String>)> = {
        // We query media_files joined to media_versions and then movies/series.
        // Simple approach: two queries (movies + series), merge.
        let movie_rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT mf.file_path, m.title
             FROM media_files mf
             JOIN media_versions mv ON mv.id = mf.version_id
             JOIN movies m ON m.id = mv.entity_id AND mv.entity_type = 'movie'"
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        let series_rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT mf.file_path, s.title
             FROM media_files mf
             JOIN media_versions mv ON mv.id = mf.version_id
             JOIN series s ON s.id = mv.entity_id AND mv.entity_type = 'series'"
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        movie_rows.into_iter().map(|(p, t)| (p, Some(t)))
            .chain(series_rows.into_iter().map(|(p, t)| (p, Some(t))))
            .collect()
    };

    let known_map: std::collections::HashMap<String, Option<String>> =
        known_rows.into_iter().collect();

    // Build preview list
    let previews: Vec<ScannedFilePreview> = all_discovered
        .iter()
        .filter(|f| all_paths.contains(&f.path.to_string_lossy().to_string()))
        .map(|f| {
            let file_path = f.path.to_string_lossy().to_string();
            let file_name = f.path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let is_duplicate = known_map.contains_key(&file_path);
            let duplicate_title = known_map.get(&file_path).and_then(|t| t.clone());
            let entity_type = match f.parsed.media_type {
                MediaType::Movie => "movie",
                MediaType::Episode => "episode",
                MediaType::Unknown => "unknown",
            }.to_string();
            let confidence = (f.parsed.confidence * 100.0).min(100.0) as u8;
            ScannedFilePreview {
                file_path,
                file_name,
                file_size_mb: f.size as f64 / 1_048_576.0,
                parsed_title: f.parsed.title.clone(),
                parsed_year: f.parsed.year,
                entity_type,
                confidence,
                quality: f.parsed.quality.clone(),
                codec: f.parsed.codec.clone(),
                is_duplicate,
                duplicate_title,
            }
        })
        .collect();

    Ok(previews)
}

/// Import a list of user-reviewed files.
/// - If tmdb_id is provided: fetches metadata from TMDB, creates the entity, attaches the file.
/// - If no tmdb_id: inserts into inbox with the user-edited title/year.
#[tauri::command]
pub async fn import_files(
    state: State<'_, AppState>,
    files: Vec<ImportFileInput>,
) -> Result<Vec<ImportFileResult>, String> {
    let db = state.db();
    let pool = db.pool();
    let tmdb_client = state.get_tmdb();

    // Get the first library id as fallback for file attachment
    let default_lib_id: i64 = sqlx::query_as::<_, (i64,)>("SELECT id FROM libraries LIMIT 1")
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?
        .map(|(id,)| id)
        .unwrap_or(0);

    let mut results = Vec::new();

    for input in files {
        let result = import_single_file(
            pool,
            &input,
            tmdb_client.as_ref(),
            default_lib_id,
            &state,
        )
        .await;

        match result {
            Ok(status) => results.push(ImportFileResult {
                file_path: input.file_path,
                title: input.title,
                status,
                error: None,
            }),
            Err(e) => results.push(ImportFileResult {
                file_path: input.file_path,
                title: input.title,
                status: "error".to_string(),
                error: Some(e),
            }),
        }
    }

    Ok(results)
}

/// Process one file — returns "imported" or "inbox" on success, Err on failure.
async fn import_single_file(
    pool: &sqlx::SqlitePool,
    input: &ImportFileInput,
    tmdb_client: Option<&crate::modules::tmdb::TmdbClient>,
    default_lib_id: i64,
    state: &crate::AppState,
) -> Result<String, String> {
    if let (Some(tmdb_id), Some(client)) = (input.tmdb_id, tmdb_client) {
        let match_result = crate::modules::tmdb::MatchResult {
            tmdb_id,
            title: input.title.clone(),
            year: input.year.map(|y| y.to_string()),
            confidence: 100,
            match_type: crate::modules::tmdb::MatchType::ExactTitle,
        };

        match input.entity_type.as_str() {
            "movie" => {
                let movie = pipeline::create_or_update_movie_pub(pool, &match_result, client)
                    .await
                    .map_err(|e| e.to_string())?;

                if default_lib_id > 0 {
                    attach_file_to_entity(
                        pool, "movie", movie.id, &input.file_path, default_lib_id,
                    ).await?;
                }

                // Cache images best-effort
                if let Some(cache) = state.image_cache.read().ok().map(|g| g.clone()) {
                    let _ = crate::modules::image_cache::cache_movie_images(
                        pool, &cache, movie.id,
                    ).await;
                }
            }
            "series" | "episode" => {
                let series = pipeline::find_or_create_series_pub(pool, &match_result, client)
                    .await
                    .map_err(|e| e.to_string())?;

                if default_lib_id > 0 {
                    attach_file_to_entity(
                        pool, "series", series.id, &input.file_path, default_lib_id,
                    ).await?;
                }

                if let Some(cache) = state.image_cache.read().ok().map(|g| g.clone()) {
                    let _ = crate::modules::image_cache::cache_series_images(
                        pool, &cache, series.id,
                    ).await;
                }
            }
            _ => {}
        }

        Ok("imported".to_string())
    } else {
        // No TMDB match — send to inbox with user-edited data
        let category = match input.entity_type.as_str() {
            "episode" => "episode",
            _ => "unrecognized",
        };

        sqlx::query(
            "INSERT OR IGNORE INTO inbox_items
             (category, status, file_path, parsed_title, parsed_year)
             VALUES (?, 'pending', ?, ?, ?)"
        )
        .bind(category)
        .bind(&input.file_path)
        .bind(&input.title)
        .bind(input.year)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok("inbox".to_string())
    }
}

/// Create a media_version + media_file record linking a file path to a movie or series.
async fn attach_file_to_entity(
    pool: &sqlx::SqlitePool,
    entity_type: &str,
    entity_id: i64,
    file_path: &str,
    library_id: i64,
) -> Result<(), String> {
    // Skip if this file is already attached
    let already: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM media_files WHERE file_path = ?"
    )
    .bind(file_path)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    if already.0 > 0 {
        return Ok(());
    }

    let version = crate::db::queries::create_media_version(pool, entity_type, entity_id, None)
        .await
        .map_err(|e| e.to_string())?;

    let file_name = std::path::Path::new(file_path)
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(file_path).map(|m| m.len() as i64).unwrap_or(0);

    crate::db::queries::create_media_file(
        pool, version.id, library_id, file_path, &file_name, Some(file_size),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
