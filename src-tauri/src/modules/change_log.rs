//! Change log module (audit trail)
//!
//! Records every modification to tracked entities:
//! - entity_type / entity_id / field / old_value / new_value / source / timestamp
//! - Enables rollback, debugging, and confidence in auto-matching
//! - Sources: scan, tmdb, manual, rule

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChangeLogEntry {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub field: String,
    pub old_value: Option<String>,
    pub new_value: Option<String>,
    pub source: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChangeSource {
    Scan,
    Tmdb,
    Manual,
    Rule,
    Import,
    Nfo,
}

impl ChangeSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            ChangeSource::Scan => "scan",
            ChangeSource::Tmdb => "tmdb",
            ChangeSource::Manual => "manual",
            ChangeSource::Rule => "rule",
            ChangeSource::Import => "import",
            ChangeSource::Nfo => "nfo",
        }
    }
}

// ============================================================================
// Recording changes
// ============================================================================

/// Record a single field change
pub async fn record_change(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    field: &str,
    old_value: Option<&str>,
    new_value: Option<&str>,
    source: ChangeSource,
) -> Result<()> {
    // Don't log if values are identical
    if old_value == new_value {
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO change_log (entity_type, entity_id, field, old_value, new_value, source)
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(field)
    .bind(old_value)
    .bind(new_value)
    .bind(source.as_str())
    .execute(pool)
    .await?;

    Ok(())
}

/// Record multiple field changes at once (for bulk updates)
pub async fn record_changes(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    changes: &[(&str, Option<&str>, Option<&str>)],
    source: ChangeSource,
) -> Result<()> {
    for (field, old_val, new_val) in changes {
        record_change(pool, entity_type, entity_id, field, *old_val, *new_val, source.clone()).await?;
    }
    Ok(())
}

/// Compare two optional string values and record if different
/// Returns true if a change was recorded
pub async fn record_if_changed(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    field: &str,
    old_value: Option<&str>,
    new_value: Option<&str>,
    source: ChangeSource,
) -> Result<bool> {
    if old_value != new_value {
        record_change(pool, entity_type, entity_id, field, old_value, new_value, source).await?;
        Ok(true)
    } else {
        Ok(false)
    }
}

// ============================================================================
// Querying history
// ============================================================================

/// Get full history for an entity
pub async fn get_entity_history(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
) -> Result<Vec<ChangeLogEntry>> {
    let rows = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log
         WHERE entity_type = ? AND entity_id = ?
         ORDER BY timestamp DESC"
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get history for a specific field of an entity
pub async fn get_field_history(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    field: &str,
) -> Result<Vec<ChangeLogEntry>> {
    let rows = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log
         WHERE entity_type = ? AND entity_id = ? AND field = ?
         ORDER BY timestamp DESC"
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(field)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get recent changes across all entities (for activity feed / dashboard)
pub async fn get_recent_changes(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<ChangeLogEntry>> {
    let rows = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log ORDER BY timestamp DESC LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get changes from a specific source
pub async fn get_changes_by_source(
    pool: &SqlitePool,
    source: &str,
    limit: i64,
) -> Result<Vec<ChangeLogEntry>> {
    let rows = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log WHERE source = ? ORDER BY timestamp DESC LIMIT ?"
    )
    .bind(source)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Rollback a single change (restore old_value)
pub async fn rollback_change(
    pool: &SqlitePool,
    change_id: i64,
) -> Result<Option<ChangeLogEntry>> {
    let entry = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log WHERE id = ?"
    )
    .bind(change_id)
    .fetch_optional(pool)
    .await?;

    let Some(entry) = entry else { return Ok(None) };

    // Build dynamic UPDATE
    let table = match entry.entity_type.as_str() {
        "movie" => "movies",
        "series" => "series",
        "season" => "seasons",
        "episode" => "episodes",
        "person" => "people",
        "studio" => "studios",
        _ => return Err(anyhow::anyhow!("Unknown entity type: {}", entry.entity_type)),
    };

    // Validate field name — only allow alphanumeric + underscore (prevent SQL injection)
    if !entry.field.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(anyhow::anyhow!("Invalid field name: {}", entry.field));
    }

    let query = format!(
        "UPDATE {} SET {} = ?, updated_at = datetime('now') WHERE id = ?",
        table, entry.field
    );

    sqlx::query(&query)
        .bind(&entry.old_value)
        .bind(entry.entity_id)
        .execute(pool)
        .await?;

    // Record the rollback as a new change
    record_change(
        pool,
        &entry.entity_type,
        entry.entity_id,
        &entry.field,
        entry.new_value.as_deref(),
        entry.old_value.as_deref(),
        ChangeSource::Manual,
    ).await?;

    Ok(Some(entry))
}

/// Count changes for an entity (useful for UI badges)
pub async fn count_entity_changes(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
) -> Result<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM change_log WHERE entity_type = ? AND entity_id = ?"
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}
