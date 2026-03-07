use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_dashboard_stats(state: State<'_, AppState>) -> Result<DbStats, String> {
    queries::get_dashboard_stats(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_genre_stats(state: State<'_, AppState>) -> Result<Vec<(String, i64)>, String> {
    queries::get_genre_stats(state.db().pool()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_additions(state: State<'_, AppState>) -> Result<Vec<RecentAddition>, String> {
    queries::get_recent_additions(state.db().pool()).await.map_err(|e| e.to_string())
}

use crate::db::models::{SuggestionItem, IncompleteSeriesRow};

#[tauri::command]
pub async fn get_recently_added_movies(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<SuggestionItem>, String> {
    queries::get_recently_added_movies(state.db().pool(), limit.unwrap_or(10))
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_incomplete_series(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<IncompleteSeriesRow>, String> {
    queries::get_incomplete_series(state.db().pool(), limit.unwrap_or(10))
        .await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_wishlist_movies(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<SuggestionItem>, String> {
    queries::get_wishlist_movies(state.db().pool(), limit.unwrap_or(10))
        .await.map_err(|e| e.to_string())
}
