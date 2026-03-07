use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_movies(state: State<'_, AppState>) -> Result<Vec<Movie>, String> {
    queries::get_movies(state.db().pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_movie(
    state: State<'_, AppState>,
    id: i64,
) -> Result<Option<Movie>, String> {
    queries::get_movie(state.db().pool(), id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_movie(
    state: State<'_, AppState>,
    input: CreateMovie,
) -> Result<Movie, String> {
    queries::create_movie(state.db().pool(), &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_movie(
    state: State<'_, AppState>,
    id: i64,
    input: UpdateMovie,
) -> Result<Option<Movie>, String> {
    let pool = state.db().pool();

    // Get current state for change tracking
    let before = queries::get_movie(pool, id).await.map_err(|e| e.to_string())?;

    let result = queries::update_movie(pool, id, &input)
        .await
        .map_err(|e| e.to_string())?;

    // Record changes
    if let (Some(ref old), Some(ref new_movie)) = (&before, &result) {
        use crate::modules::change_log::{self, ChangeSource};
        if input.title.is_some() && old.title != new_movie.title {
            change_log::record_change(pool, "movie", id, "title",
                Some(&old.title), Some(&new_movie.title), ChangeSource::Manual).await.ok();
        }
        if input.overview.is_some() && old.overview != new_movie.overview {
            change_log::record_change(pool, "movie", id, "overview",
                old.overview.as_deref(), new_movie.overview.as_deref(), ChangeSource::Manual).await.ok();
        }
        if input.year.is_some() && old.year != new_movie.year {
            change_log::record_change(pool, "movie", id, "year",
                old.year.map(|y| y.to_string()).as_deref(),
                new_movie.year.map(|y| y.to_string()).as_deref(),
                ChangeSource::Manual).await.ok();
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn delete_movie(
    state: State<'_, AppState>,
    id: i64,
) -> Result<bool, String> {
    queries::delete_movie(state.db().pool(), id)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Movie versions & files
// ============================================================================

#[tauri::command]
pub async fn get_movie_versions(state: State<'_, AppState>, movie_id: i64) -> Result<Vec<MediaVersion>, String> {
    queries::get_movie_versions(state.db().pool(), movie_id)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_version_files(state: State<'_, AppState>, version_id: i64) -> Result<Vec<MediaFile>, String> {
    queries::get_version_files(state.db().pool(), version_id)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_similar_movies(state: State<'_, AppState>, movie_id: i64, limit: Option<i64>) -> Result<Vec<SimilarMovie>, String> {
    queries::find_similar_movies(state.db().pool(), movie_id, limit.unwrap_or(8))
        .await.map_err(|e| e.to_string())
}

// ============================================================================
// Duplicate detection
// ============================================================================

#[tauri::command]
pub async fn find_exact_duplicates(state: State<'_, AppState>) -> Result<Vec<DuplicateGroup>, String> {
    queries::find_exact_duplicates(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_probable_duplicates(state: State<'_, AppState>) -> Result<Vec<DuplicateGroup>, String> {
    queries::find_probable_movie_duplicates(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_multi_version_movies(state: State<'_, AppState>) -> Result<Vec<DuplicateGroup>, String> {
    queries::find_multi_version_movies(state.db().pool()).await.map_err(|e| e.to_string())
}
