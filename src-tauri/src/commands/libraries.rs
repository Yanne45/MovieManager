use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_libraries(state: State<'_, AppState>) -> Result<Vec<Library>, String> {
    queries::get_libraries(state.db().pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_library(
    state: State<'_, AppState>,
    input: CreateLibrary,
) -> Result<Library, String> {
    queries::create_library(state.db().pool(), &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_library(
    state: State<'_, AppState>,
    id: i64,
    input: UpdateLibrary,
) -> Result<Option<Library>, String> {
    queries::update_library(state.db().pool(), id, &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_library(
    state: State<'_, AppState>,
    id: i64,
) -> Result<bool, String> {
    queries::delete_library(state.db().pool(), id)
        .await
        .map_err(|e| e.to_string())
}
