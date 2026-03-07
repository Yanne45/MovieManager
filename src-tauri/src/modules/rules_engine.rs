//! Rules engine module
//!
//! Simple condition → action pattern applied to media versions:
//! - Conditions: field / operator / value (e.g. codec = "HEVC", resolution >= 2160)
//! - Actions: add tag, set genre, set flag
//! - Rules are stored as JSON in the `rules` table
//! - Applied after FFprobe analysis or on-demand

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

// ============================================================================
// Rule model
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: i64,
    pub name: String,
    pub enabled: bool,
    pub condition: RuleCondition,
    pub action: RuleAction,
    pub priority: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleCondition {
    pub field: String,
    pub operator: ConditionOperator,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConditionOperator {
    #[serde(rename = "eq")]
    Equals,
    #[serde(rename = "neq")]
    NotEquals,
    #[serde(rename = "gt")]
    GreaterThan,
    #[serde(rename = "gte")]
    GreaterOrEqual,
    #[serde(rename = "lt")]
    LessThan,
    #[serde(rename = "lte")]
    LessOrEqual,
    #[serde(rename = "contains")]
    Contains,
    #[serde(rename = "not_contains")]
    NotContains,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleAction {
    pub action_type: ActionType,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActionType {
    #[serde(rename = "add_tag")]
    AddTag,
    #[serde(rename = "set_genre")]
    SetGenre,
    #[serde(rename = "set_quality_score")]
    SetQualityScore,
}

/// Result of applying rules to a single entity
#[derive(Debug, Serialize)]
pub struct RuleApplicationResult {
    pub entity_type: String,
    pub entity_id: i64,
    pub rules_applied: Vec<AppliedRule>,
}

#[derive(Debug, Serialize)]
pub struct AppliedRule {
    pub rule_id: i64,
    pub rule_name: String,
    pub action_description: String,
}

// ============================================================================
// Context — fields available for rule evaluation
// ============================================================================

/// Flattened context from a media_version + media_file for evaluation
#[derive(Debug)]
pub struct EvalContext {
    pub owner_type: String,
    pub owner_id: i64,
    pub resolution: String,
    pub video_codec: String,
    pub audio_codec: String,
    pub audio_channels: String,
    pub video_bitrate: i64,
    pub audio_bitrate: i64,
    pub hdr_format: String,
    pub container: String,
    pub quality_score: String,
    pub file_path: String,
    pub label: String,
}

// ============================================================================
// Rule evaluation
// ============================================================================

/// Evaluate a condition against a context
fn evaluate_condition(condition: &RuleCondition, ctx: &EvalContext) -> bool {
    let field_value = match condition.field.as_str() {
        "resolution" => &ctx.resolution,
        "video_codec" | "codec" => &ctx.video_codec,
        "audio_codec" => &ctx.audio_codec,
        "audio_channels" => &ctx.audio_channels,
        "hdr_format" | "hdr" => &ctx.hdr_format,
        "container" => &ctx.container,
        "quality_score" => &ctx.quality_score,
        "file_path" | "path" => &ctx.file_path,
        "label" => &ctx.label,
        "owner_type" => &ctx.owner_type,
        // Numeric fields handled specially
        "video_bitrate" | "bitrate" => {
            return evaluate_numeric(condition, ctx.video_bitrate);
        }
        "audio_bitrate" => {
            return evaluate_numeric(condition, ctx.audio_bitrate);
        }
        "resolution_height" | "height" => {
            let height = parse_resolution_height(&ctx.resolution);
            return evaluate_numeric(condition, height);
        }
        _ => return false,
    };

    let field_lower = field_value.to_lowercase();
    let value_lower = condition.value.to_lowercase();

    match condition.operator {
        ConditionOperator::Equals => field_lower == value_lower,
        ConditionOperator::NotEquals => field_lower != value_lower,
        ConditionOperator::Contains => field_lower.contains(&value_lower),
        ConditionOperator::NotContains => !field_lower.contains(&value_lower),
        ConditionOperator::GreaterThan | ConditionOperator::GreaterOrEqual
        | ConditionOperator::LessThan | ConditionOperator::LessOrEqual => {
            // Try numeric comparison on string fields
            if let (Ok(fv), Ok(cv)) = (field_value.parse::<i64>(), condition.value.parse::<i64>()) {
                evaluate_numeric_op(&condition.operator, fv, cv)
            } else {
                false
            }
        }
    }
}

fn evaluate_numeric(condition: &RuleCondition, actual: i64) -> bool {
    let target = condition.value.parse::<i64>().unwrap_or(0);
    evaluate_numeric_op(&condition.operator, actual, target)
}

fn evaluate_numeric_op(op: &ConditionOperator, actual: i64, target: i64) -> bool {
    match op {
        ConditionOperator::Equals => actual == target,
        ConditionOperator::NotEquals => actual != target,
        ConditionOperator::GreaterThan => actual > target,
        ConditionOperator::GreaterOrEqual => actual >= target,
        ConditionOperator::LessThan => actual < target,
        ConditionOperator::LessOrEqual => actual <= target,
        _ => false,
    }
}

fn parse_resolution_height(label: &str) -> i64 {
    match label.to_uppercase().as_str() {
        "4K" => 2160,
        "1440P" => 1440,
        "1080P" => 1080,
        "720P" => 720,
        "480P" => 480,
        _ => label.replace("p", "").replace("P", "").parse().unwrap_or(0),
    }
}

// ============================================================================
// Rule application
// ============================================================================

/// Load all enabled rules from DB, ordered by priority (for rule execution)
pub async fn load_rules(pool: &SqlitePool) -> Result<Vec<Rule>> {
    load_rules_filtered(pool, true).await
}

/// Load ALL rules from DB (enabled + disabled), for UI management screen
pub async fn load_all_rules(pool: &SqlitePool) -> Result<Vec<Rule>> {
    load_rules_filtered(pool, false).await
}

async fn load_rules_filtered(pool: &SqlitePool, enabled_only: bool) -> Result<Vec<Rule>> {
    let query = if enabled_only {
        "SELECT id, name, enabled, condition_json, action_json, priority FROM rules WHERE enabled = 1 ORDER BY priority ASC"
    } else {
        "SELECT id, name, enabled, condition_json, action_json, priority FROM rules ORDER BY priority ASC"
    };

    let rows: Vec<(i64, String, bool, String, String, i64)> = sqlx::query_as(query)
        .fetch_all(pool)
        .await?;

    let mut rules = Vec::new();
    for (id, name, enabled, cond_json, act_json, priority) in rows {
        let condition: RuleCondition = serde_json::from_str(&cond_json)?;
        let action: RuleAction = serde_json::from_str(&act_json)?;
        rules.push(Rule { id, name, enabled, condition, action, priority });
    }
    Ok(rules)
}

/// Apply all enabled rules to a single media_version
pub async fn apply_rules_to_version(
    pool: &SqlitePool,
    version_id: i64,
) -> Result<RuleApplicationResult> {
    // Build context from media_version
    let ctx = build_context(pool, version_id).await?;
    let rules = load_rules(pool).await?;

    let mut applied = Vec::new();

    for rule in &rules {
        if evaluate_condition(&rule.condition, &ctx) {
            execute_action(pool, &rule.action, &ctx).await?;

            // Log rule application
            sqlx::query(
                "INSERT INTO rules_log (rule_id, entity_type, entity_id, action_description)
                 VALUES (?, ?, ?, ?)"
            )
            .bind(rule.id)
            .bind(&ctx.owner_type)
            .bind(ctx.owner_id)
            .bind(format!("{:?} → {}", rule.action.action_type, rule.action.value))
            .execute(pool)
            .await
            .ok(); // Non-blocking if rules_log doesn't exist yet

            applied.push(AppliedRule {
                rule_id: rule.id,
                rule_name: rule.name.clone(),
                action_description: format!("{:?}: {}", rule.action.action_type, rule.action.value),
            });
        }
    }

    Ok(RuleApplicationResult {
        entity_type: ctx.owner_type,
        entity_id: ctx.owner_id,
        rules_applied: applied,
    })
}

/// Apply all rules to all versions in a library
pub async fn apply_rules_to_library(
    pool: &SqlitePool,
    library_id: i64,
) -> Result<Vec<RuleApplicationResult>> {
    let version_ids: Vec<(i64,)> = sqlx::query_as(
        "SELECT DISTINCT mv.id
         FROM media_versions mv
         JOIN media_files mf ON mf.media_version_id = mv.id
         WHERE mf.library_id = ?"
    )
    .bind(library_id)
    .fetch_all(pool)
    .await?;

    let mut results = Vec::new();
    for (vid,) in version_ids {
        match apply_rules_to_version(pool, vid).await {
            Ok(r) if !r.rules_applied.is_empty() => results.push(r),
            Ok(_) => {} // No rules matched
            Err(e) => log::warn!("Rule application failed for version {}: {}", vid, e),
        }
    }
    Ok(results)
}

/// Build evaluation context from a media_version row
async fn build_context(pool: &SqlitePool, version_id: i64) -> Result<EvalContext> {
    let row: (String, i64, Option<String>, Option<String>, Option<String>, Option<String>,
              Option<i64>, Option<i64>, Option<String>, Option<String>, Option<String>, Option<String>) =
        sqlx::query_as(
            "SELECT mv.owner_type, mv.owner_id, mv.resolution, mv.video_codec,
                    mv.audio_codec, mv.audio_channels, mv.video_bitrate, mv.audio_bitrate,
                    mv.hdr_format, mv.container, mv.quality_score, mv.label
             FROM media_versions mv WHERE mv.id = ?"
        )
        .bind(version_id)
        .fetch_one(pool)
        .await?;

    // Get file_path from first associated file
    let file_path: Option<(String,)> = sqlx::query_as(
        "SELECT file_path FROM media_files WHERE media_version_id = ? LIMIT 1"
    )
    .bind(version_id)
    .fetch_optional(pool)
    .await?;

    Ok(EvalContext {
        owner_type: row.0,
        owner_id: row.1,
        resolution: row.2.unwrap_or_default(),
        video_codec: row.3.unwrap_or_default(),
        audio_codec: row.4.unwrap_or_default(),
        audio_channels: row.5.unwrap_or_default(),
        video_bitrate: row.6.unwrap_or(0),
        audio_bitrate: row.7.unwrap_or(0),
        hdr_format: row.8.unwrap_or_default(),
        container: row.9.unwrap_or_default(),
        quality_score: row.10.unwrap_or_default(),
        label: row.11.unwrap_or_default(),
        file_path: file_path.map(|f| f.0).unwrap_or_default(),
    })
}

/// Execute a rule action
async fn execute_action(pool: &SqlitePool, action: &RuleAction, ctx: &EvalContext) -> Result<()> {
    match action.action_type {
        ActionType::AddTag => {
            // Find or create tag (auto_generated = true)
            let tag_id: (i64,) = sqlx::query_as(
                "INSERT INTO tags (name, auto_generated) VALUES (?, 1)
                 ON CONFLICT(name) DO UPDATE SET name = name
                 RETURNING id"
            )
            .bind(&action.value)
            .fetch_one(pool)
            .await?;

            // Link to entity
            match ctx.owner_type.as_str() {
                "movie" => {
                    sqlx::query("INSERT OR IGNORE INTO movie_tags (movie_id, tag_id) VALUES (?, ?)")
                        .bind(ctx.owner_id)
                        .bind(tag_id.0)
                        .execute(pool)
                        .await?;
                }
                "episode" => {
                    // For episodes, tag the parent series
                    let series_id: Option<(i64,)> = sqlx::query_as(
                        "SELECT series_id FROM episodes WHERE id = ?"
                    )
                    .bind(ctx.owner_id)
                    .fetch_optional(pool)
                    .await?;

                    if let Some((sid,)) = series_id {
                        sqlx::query("INSERT OR IGNORE INTO series_tags (series_id, tag_id) VALUES (?, ?)")
                            .bind(sid)
                            .bind(tag_id.0)
                            .execute(pool)
                            .await?;
                    }
                }
                _ => {}
            }
        }
        ActionType::SetGenre => {
            let genre_id: (i64,) = sqlx::query_as(
                "INSERT INTO genres (name) VALUES (?)
                 ON CONFLICT(name) DO UPDATE SET name = name
                 RETURNING id"
            )
            .bind(&action.value)
            .fetch_one(pool)
            .await?;

            match ctx.owner_type.as_str() {
                "movie" => {
                    sqlx::query("INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)")
                        .bind(ctx.owner_id)
                        .bind(genre_id.0)
                        .execute(pool)
                        .await?;
                }
                "episode" => {
                    let series_id: Option<(i64,)> = sqlx::query_as(
                        "SELECT series_id FROM episodes WHERE id = ?"
                    )
                    .bind(ctx.owner_id)
                    .fetch_optional(pool)
                    .await?;

                    if let Some((sid,)) = series_id {
                        sqlx::query("INSERT OR IGNORE INTO series_genres (series_id, genre_id) VALUES (?, ?)")
                            .bind(sid)
                            .bind(genre_id.0)
                            .execute(pool)
                            .await?;
                    }
                }
                _ => {}
            }
        }
        ActionType::SetQualityScore => {
            sqlx::query(
                "UPDATE media_versions SET quality_score = ?, updated_at = datetime('now') WHERE id = ?"
            )
            .bind(&action.value)
            .execute(pool)
            .await?;
        }
    }
    Ok(())
}

// ============================================================================
// CRUD helpers (for commands)
// ============================================================================

pub async fn create_rule(
    pool: &SqlitePool,
    name: &str,
    condition: &RuleCondition,
    action: &RuleAction,
    priority: i64,
) -> Result<i64> {
    let cond_json = serde_json::to_string(condition)?;
    let act_json = serde_json::to_string(action)?;

    let row: (i64,) = sqlx::query_as(
        "INSERT INTO rules (name, enabled, condition_json, action_json, priority)
         VALUES (?, 1, ?, ?, ?) RETURNING id"
    )
    .bind(name)
    .bind(&cond_json)
    .bind(&act_json)
    .bind(priority)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

pub async fn toggle_rule(pool: &SqlitePool, rule_id: i64, enabled: bool) -> Result<()> {
    sqlx::query("UPDATE rules SET enabled = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(enabled)
        .bind(rule_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_rule(pool: &SqlitePool, rule_id: i64) -> Result<bool> {
    let r = sqlx::query("DELETE FROM rules WHERE id = ?")
        .bind(rule_id)
        .execute(pool)
        .await?;
    Ok(r.rows_affected() > 0)
}

// ============================================================================
// Tests
// ============================================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn make_ctx() -> EvalContext {
        EvalContext {
            owner_type: "movie".into(), owner_id: 1,
            resolution: "4K".into(), video_codec: "HEVC".into(),
            audio_codec: "TrueHD".into(), audio_channels: "7.1".into(),
            video_bitrate: 18000000, audio_bitrate: 4000000,
            hdr_format: "HDR10".into(), container: "matroska".into(),
            quality_score: "A".into(), file_path: "/media/Concert/show.mkv".into(),
            label: "4K HDR".into(),
        }
    }

    #[test]
    fn test_equals() {
        let cond = RuleCondition { field: "codec".into(), operator: ConditionOperator::Equals, value: "HEVC".into() };
        assert!(evaluate_condition(&cond, &make_ctx()));
    }

    #[test]
    fn test_contains_path() {
        let cond = RuleCondition { field: "path".into(), operator: ConditionOperator::Contains, value: "Concert".into() };
        assert!(evaluate_condition(&cond, &make_ctx()));
    }

    #[test]
    fn test_gte_bitrate() {
        let cond = RuleCondition { field: "bitrate".into(), operator: ConditionOperator::GreaterOrEqual, value: "15000000".into() };
        assert!(evaluate_condition(&cond, &make_ctx()));
    }

    #[test]
    fn test_lt_bitrate() {
        let cond = RuleCondition { field: "bitrate".into(), operator: ConditionOperator::LessThan, value: "2000000".into() };
        assert!(!evaluate_condition(&cond, &make_ctx()));
    }

    #[test]
    fn test_height_gte() {
        let cond = RuleCondition { field: "height".into(), operator: ConditionOperator::GreaterOrEqual, value: "2160".into() };
        assert!(evaluate_condition(&cond, &make_ctx()));
    }

    #[test]
    fn test_not_contains() {
        let cond = RuleCondition { field: "path".into(), operator: ConditionOperator::NotContains, value: "Temp".into() };
        assert!(evaluate_condition(&cond, &make_ctx()));
    }
}
