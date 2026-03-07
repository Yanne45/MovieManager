use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn update_episode(
    state: State<'_, AppState>,
    id: i64,
    title: Option<String>,
    overview: Option<String>,
    runtime: Option<i64>,
) -> Result<Option<Episode>, String> {
    queries::update_episode(
        state.db().pool(), id,
        title.as_deref(), overview.as_deref(), runtime,
    )
    .await
    .map_err(|e| e.to_string())
}
