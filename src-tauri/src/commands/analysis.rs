use crate::db::queries;
use crate::modules::media_analysis::{self, MediaAnalysis, FfprobeStatus};
use crate::AppState;
use sqlx;
use tauri::State;

/// Analyze a single file by its media_file ID
#[tauri::command]
pub async fn analyze_media_file(
    state: State<'_, AppState>,
    media_file_id: i64,
) -> Result<MediaAnalysis, String> {
    let pool = state.db().pool();

    // Get file path
    let (version_id, file_path): (i64, String) = sqlx::query_as(
        "SELECT media_version_id, file_path FROM media_files WHERE id = ?"
    )
    .bind(media_file_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Media file {} not found", media_file_id))?;

    media_analysis::analyze_and_update(pool, version_id, &file_path)
        .await
        .map_err(|e| format!("Analysis failed: {}", e))
}

/// Analyze all files for a given movie (all versions)
#[tauri::command]
pub async fn analyze_movie_files(
    state: State<'_, AppState>,
    movie_id: i64,
) -> Result<Vec<MediaAnalysis>, String> {
    let pool = state.db().pool();
    let versions = queries::get_movie_versions(pool, movie_id)
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();

    for version in &versions {
        let files = queries::get_version_files(pool, version.id)
            .await
            .map_err(|e| e.to_string())?;

        for file in &files {
            match media_analysis::analyze_and_update(pool, version.id, &file.file_path).await {
                Ok(analysis) => results.push(analysis),
                Err(e) => {
                    log::warn!("Failed to analyze {}: {}", file.file_path, e);
                }
            }
        }
    }

    Ok(results)
}

/// Batch analyze all unanalyzed files in a library
#[tauri::command]
pub async fn analyze_library(
    state: State<'_, AppState>,
    library_id: i64,
) -> Result<AnalyzeLibraryResult, String> {
    let pool = state.db().pool();

    // Find all media_files in this library where the version has no quality_score yet
    let unanalyzed: Vec<(i64, i64, String)> = sqlx::query_as(
        "SELECT mf.id, mf.media_version_id, mf.file_path
         FROM media_files mf
         JOIN media_versions mv ON mv.id = mf.media_version_id
         WHERE mf.library_id = ? AND (mv.quality_score IS NULL OR mv.video_codec IS NULL)"
    )
    .bind(library_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let total = unanalyzed.len();
    let mut analyzed = 0;
    let mut errors = 0;

    for (_file_id, version_id, file_path) in &unanalyzed {
        match media_analysis::analyze_and_update(pool, *version_id, file_path).await {
            Ok(_) => analyzed += 1,
            Err(e) => {
                log::warn!("Failed to analyze {}: {}", file_path, e);
                errors += 1;
            }
        }
    }

    // Update library total_size
    let total_size: Option<(i64,)> = sqlx::query_as(
        "SELECT COALESCE(SUM(mf.file_size), 0) FROM media_files mf WHERE mf.library_id = ?"
    )
    .bind(library_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    if let Some((size,)) = total_size {
        sqlx::query("UPDATE libraries SET total_size = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(size)
            .bind(library_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(AnalyzeLibraryResult { total, analyzed, errors })
}

#[derive(Debug, serde::Serialize)]
pub struct AnalyzeLibraryResult {
    pub total: usize,
    pub analyzed: usize,
    pub errors: usize,
}

#[tauri::command]
pub async fn check_ffprobe() -> Result<FfprobeStatus, String> {
    Ok(crate::modules::media_analysis::check_ffprobe())
}
