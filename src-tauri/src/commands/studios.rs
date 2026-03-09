use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_studios(state: State<'_, AppState>) -> Result<Vec<Studio>, String> {
    queries::get_studios(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_studio(
    state: State<'_, AppState>,
    name: String, country: Option<String>, tmdb_id: Option<i64>,
) -> Result<Studio, String> {
    queries::create_studio(state.db().pool(), &name, country.as_deref(), tmdb_id)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_studio(
    state: State<'_, AppState>,
    id: i64, name: Option<String>, country: Option<String>,
    description: Option<String>, notes: Option<String>,
) -> Result<Option<Studio>, String> {
    queries::update_studio(state.db().pool(), id, name.as_deref(), country.as_deref(), description.as_deref(), notes.as_deref())
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_studio(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    queries::delete_studio(state.db().pool(), id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_movie_studios(state: State<'_, AppState>, movie_id: i64) -> Result<Vec<MovieStudioRow>, String> {
    queries::get_movie_studios(state.db().pool(), movie_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_movie_studio(state: State<'_, AppState>, movie_id: i64, studio_id: i64) -> Result<(), String> {
    queries::add_movie_studio(state.db().pool(), movie_id, studio_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_movie_studio(state: State<'_, AppState>, movie_id: i64, studio_id: i64) -> Result<(), String> {
    queries::remove_movie_studio(state.db().pool(), movie_id, studio_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_studio_movies(state: State<'_, AppState>, studio_id: i64) -> Result<Vec<StudioMovieRow>, String> {
    queries::get_studio_movies(state.db().pool(), studio_id).await.map_err(|e| e.to_string())
}
