//! Change log module (audit trail)
//!
//! Records every modification to tracked entities:
//! - entity_type / entity_id / field / old_value / new_value / source / timestamp / operation_id
//! - Enables rollback (single or grouped by operation), debugging, and confidence in auto-matching
//! - Sources: scan, tmdb, manual, rule, import, nfo

use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

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
    pub operation_id: Option<String>,
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

/// Summary of a grouped operation
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OperationSummary {
    pub operation_id: String,
    pub source: String,
    pub timestamp: String, // earliest timestamp
    pub change_count: i64,
    pub entity_count: i64,
}

// ============================================================================
// Operation ID generation
// ============================================================================

/// Generate a new unique operation ID (UUID v4)
pub fn new_operation_id() -> String {
    Uuid::new_v4().to_string()
}

// ============================================================================
// Recording changes
// ============================================================================

/// Record a single field change (with optional operation_id)
pub async fn record_change(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    field: &str,
    old_value: Option<&str>,
    new_value: Option<&str>,
    source: ChangeSource,
) -> Result<()> {
    record_change_op(pool, entity_type, entity_id, field, old_value, new_value, source, None).await
}

/// Record a single field change with an operation_id
pub async fn record_change_op(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    field: &str,
    old_value: Option<&str>,
    new_value: Option<&str>,
    source: ChangeSource,
    operation_id: Option<&str>,
) -> Result<()> {
    // Don't log if values are identical
    if old_value == new_value {
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO change_log (entity_type, entity_id, field, old_value, new_value, source, operation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(field)
    .bind(old_value)
    .bind(new_value)
    .bind(source.as_str())
    .bind(operation_id)
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

// ============================================================================
// Operation queries
// ============================================================================

/// List recent operations (grouped by operation_id)
pub async fn get_operations(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<OperationSummary>> {
    let rows = sqlx::query_as::<_, OperationSummary>(
        "SELECT operation_id, source,
                MIN(timestamp) AS timestamp,
                COUNT(*) AS change_count,
                COUNT(DISTINCT entity_type || ':' || entity_id) AS entity_count
         FROM change_log
         WHERE operation_id IS NOT NULL
         GROUP BY operation_id
         ORDER BY MIN(timestamp) DESC
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get all changes for a given operation
pub async fn get_operation_changes(
    pool: &SqlitePool,
    operation_id: &str,
) -> Result<Vec<ChangeLogEntry>> {
    let rows = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log WHERE operation_id = ? ORDER BY id ASC"
    )
    .bind(operation_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

// ============================================================================
// Rollback
// ============================================================================

fn entity_table(entity_type: &str) -> Result<&str> {
    match entity_type {
        "movie" => Ok("movies"),
        "series" => Ok("series"),
        "season" => Ok("seasons"),
        "episode" => Ok("episodes"),
        "person" => Ok("people"),
        "studio" => Ok("studios"),
        _ => Err(anyhow::anyhow!("Unknown entity type: {}", entity_type)),
    }
}

fn validate_field(field: &str) -> Result<()> {
    if !field.chars().all(|c| c.is_alphanumeric() || c == '_') {
        Err(anyhow::anyhow!("Invalid field name: {}", field))
    } else {
        Ok(())
    }
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

    let table = entity_table(&entry.entity_type)?;
    validate_field(&entry.field)?;

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

/// Rollback all changes in an operation (in reverse order)
/// Returns the number of changes rolled back
pub async fn rollback_operation(
    pool: &SqlitePool,
    operation_id: &str,
) -> Result<i64> {
    let entries = sqlx::query_as::<_, ChangeLogEntry>(
        "SELECT * FROM change_log WHERE operation_id = ? ORDER BY id DESC"
    )
    .bind(operation_id)
    .fetch_all(pool)
    .await?;

    if entries.is_empty() {
        return Err(anyhow::anyhow!("No changes found for operation {}", operation_id));
    }

    let rollback_op_id = new_operation_id();
    let mut count: i64 = 0;

    for entry in &entries {
        let table = match entity_table(&entry.entity_type) {
            Ok(t) => t,
            Err(e) => {
                log::warn!("Rollback: skipping entry {} — {}", entry.id, e);
                continue;
            }
        };
        if let Err(e) = validate_field(&entry.field) {
            log::warn!("Rollback: skipping entry {} — {}", entry.id, e);
            continue;
        }

        let query = format!(
            "UPDATE {} SET {} = ?, updated_at = datetime('now') WHERE id = ?",
            table, entry.field
        );

        let result = sqlx::query(&query)
            .bind(&entry.old_value)
            .bind(entry.entity_id)
            .execute(pool)
            .await;

        match result {
            Ok(_) => {
                // Record the rollback change with a new operation_id
                record_change_op(
                    pool,
                    &entry.entity_type,
                    entry.entity_id,
                    &entry.field,
                    entry.new_value.as_deref(),
                    entry.old_value.as_deref(),
                    ChangeSource::Manual,
                    Some(&rollback_op_id),
                ).await?;
                count += 1;
            }
            Err(e) => {
                log::warn!(
                    "Rollback: failed to revert entry {} ({}.{} on id {}): {}",
                    entry.id, entry.entity_type, entry.field, entry.entity_id, e
                );
            }
        }
    }

    Ok(count)
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
