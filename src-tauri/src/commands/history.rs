use crate::modules::change_log::{self, ChangeLogEntry, OperationSummary};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_entity_history(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
) -> Result<Vec<ChangeLogEntry>, String> {
    change_log::get_entity_history(state.db().pool(), &entity_type, entity_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_changes(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<ChangeLogEntry>, String> {
    change_log::get_recent_changes(state.db().pool(), limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rollback_change(
    state: State<'_, AppState>,
    change_id: i64,
) -> Result<Option<ChangeLogEntry>, String> {
    change_log::rollback_change(state.db().pool(), change_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_operations(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<OperationSummary>, String> {
    change_log::get_operations(state.db().pool(), limit.unwrap_or(50))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_operation_changes(
    state: State<'_, AppState>,
    operation_id: String,
) -> Result<Vec<ChangeLogEntry>, String> {
    change_log::get_operation_changes(state.db().pool(), &operation_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rollback_operation(
    state: State<'_, AppState>,
    operation_id: String,
) -> Result<i64, String> {
    change_log::rollback_operation(state.db().pool(), &operation_id)
        .await
        .map_err(|e| e.to_string())
}
