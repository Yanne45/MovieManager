use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_tags(state: State<'_, AppState>) -> Result<Vec<Tag>, String> {
    queries::get_tags(state.db().pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppState>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    queries::create_tag(state.db().pool(), &name, color.as_deref(), false)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_tag(
    state: State<'_, AppState>,
    id: i64,
) -> Result<bool, String> {
    queries::delete_tag(state.db().pool(), id)
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Genre commands
// ============================================================================

#[tauri::command]
pub async fn get_genres(state: State<'_, AppState>) -> Result<Vec<Genre>, String> {
    queries::get_genres(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_genre(state: State<'_, AppState>, name: String, tmdb_id: Option<i64>) -> Result<Genre, String> {
    queries::create_genre(state.db().pool(), &name, tmdb_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_movie_genres(state: State<'_, AppState>, movie_id: i64) -> Result<Vec<Genre>, String> {
    queries::get_movie_genres(state.db().pool(), movie_id).await.map_err(|e| e.to_string())
}
