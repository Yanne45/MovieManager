use crate::modules::rules_engine::{self, Rule, RuleCondition, RuleAction, RuleApplicationResult};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_rules(state: State<'_, AppState>) -> Result<Vec<Rule>, String> {
    rules_engine::load_all_rules(state.db().pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_rule(
    state: State<'_, AppState>,
    name: String,
    condition: RuleCondition,
    action: RuleAction,
    priority: Option<i64>,
) -> Result<i64, String> {
    rules_engine::create_rule(state.db().pool(), &name, &condition, &action, priority.unwrap_or(100))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_rule(
    state: State<'_, AppState>,
    rule_id: i64,
    enabled: bool,
) -> Result<(), String> {
    rules_engine::toggle_rule(state.db().pool(), rule_id, enabled)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_rule(
    state: State<'_, AppState>,
    rule_id: i64,
) -> Result<bool, String> {
    rules_engine::delete_rule(state.db().pool(), rule_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn apply_rules_library(
    state: State<'_, AppState>,
    library_id: i64,
) -> Result<Vec<RuleApplicationResult>, String> {
    rules_engine::apply_rules_to_library(state.db().pool(), library_id)
        .await
        .map_err(|e| e.to_string())
}
