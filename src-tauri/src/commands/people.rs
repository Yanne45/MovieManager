use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_people(state: State<'_, AppState>) -> Result<Vec<Person>, String> {
    queries::get_people(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_person(state: State<'_, AppState>, id: i64) -> Result<Option<Person>, String> {
    queries::get_person(state.db().pool(), id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_person(
    state: State<'_, AppState>,
    name: String,
    primary_role: Option<String>,
    tmdb_id: Option<i64>,
) -> Result<Person, String> {
    queries::create_person(state.db().pool(), &name, primary_role.as_deref(), tmdb_id)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_person(
    state: State<'_, AppState>,
    id: i64,
    name: Option<String>,
    primary_role: Option<String>,
    biography: Option<String>,
    notes: Option<String>,
) -> Result<Option<Person>, String> {
    queries::update_person(state.db().pool(), id, name.as_deref(), primary_role.as_deref(), biography.as_deref(), notes.as_deref())
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_person(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    queries::delete_person(state.db().pool(), id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_movie_people(state: State<'_, AppState>, movie_id: i64) -> Result<Vec<MoviePersonRow>, String> {
    queries::get_movie_people(state.db().pool(), movie_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_movie_person(
    state: State<'_, AppState>,
    movie_id: i64, person_id: i64, role: String,
    character_name: Option<String>, credit_order: Option<i64>,
) -> Result<(), String> {
    queries::add_movie_person(state.db().pool(), movie_id, person_id, &role, character_name.as_deref(), credit_order)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_movie_person(
    state: State<'_, AppState>,
    movie_id: i64, person_id: i64, role: String,
) -> Result<(), String> {
    queries::remove_movie_person(state.db().pool(), movie_id, person_id, &role)
        .await.map_err(|e| e.to_string())
}
