use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_collections(state: State<'_, AppState>) -> Result<Vec<CollectionWithCount>, String> {
    queries::get_collections_with_counts(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_collection(
    state: State<'_, AppState>,
    name: String, description: Option<String>,
) -> Result<Collection, String> {
    queries::create_collection(state.db().pool(), &name, description.as_deref())
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_collection(
    state: State<'_, AppState>,
    id: i64, name: Option<String>, description: Option<String>,
) -> Result<Option<Collection>, String> {
    queries::update_collection(state.db().pool(), id, name.as_deref(), description.as_deref())
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_collection(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    queries::delete_collection(state.db().pool(), id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_collection_items(state: State<'_, AppState>, collection_id: i64) -> Result<Vec<CollectionItemRow>, String> {
    queries::get_collection_items(state.db().pool(), collection_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_collection_item(
    state: State<'_, AppState>,
    collection_id: i64, movie_id: Option<i64>, series_id: Option<i64>,
) -> Result<(), String> {
    queries::add_collection_item(state.db().pool(), collection_id, movie_id, series_id)
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_collection_item(state: State<'_, AppState>, item_id: i64) -> Result<bool, String> {
    queries::remove_collection_item(state.db().pool(), item_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_collection_item(state: State<'_, AppState>, item_id: i64, new_position: i64) -> Result<(), String> {
    queries::reorder_collection_item(state.db().pool(), item_id, new_position)
        .await.map_err(|e| e.to_string())
}
