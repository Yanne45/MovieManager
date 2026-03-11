use crate::db::models::InboxItem;
use crate::AppState;
use sqlx;
use tauri::State;

/// Get all pending inbox items
#[tauri::command]
pub async fn get_inbox_items(
    state: State<'_, AppState>,
    status: Option<String>,
) -> Result<Vec<InboxItem>, String> {
    let db = state.db();
    let pool = db.pool();
    let items = if matches!(status.as_deref(), Some("all")) {
        sqlx::query_as::<_, InboxItem>(
            "SELECT * FROM inbox_items ORDER BY created_at DESC"
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
    } else {
        let filter = status.as_deref().unwrap_or("pending");
        sqlx::query_as::<_, InboxItem>(
            "SELECT * FROM inbox_items WHERE status = ? ORDER BY created_at DESC"
        )
        .bind(filter)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(items)
}

/// Count pending inbox items (for sidebar badge)
#[tauri::command]
pub async fn get_inbox_count(state: State<'_, AppState>) -> Result<i64, String> {
    let db = state.db();
    let pool = db.pool();
    let row: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM inbox_items WHERE status = 'pending'"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(row.0)
}

/// Link an inbox item to a TMDB entry — fetches data, creates entity, links file
#[tauri::command]
pub async fn resolve_inbox_link(
    state: State<'_, AppState>,
    inbox_id: i64,
    entity_type: String,
    entity_id: i64, // TMDB ID from the search
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();

    // Get the inbox item to retrieve file info
    let item: InboxItem = sqlx::query_as(
        "SELECT * FROM inbox_items WHERE id = ?"
    )
    .bind(inbox_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| format!("Élément inbox {} introuvable", inbox_id))?;

    let tmdb_id = entity_id;
    let mut resolved_entity_id: Option<i64> = None;
    let mut resolution_note = String::from("linked manually");

    // Try to get TMDB client for fetching full data
    if let Some(tmdb_client) = state.get_tmdb() {
        match entity_type.as_str() {
            "movie" => {
                let match_result = crate::modules::tmdb::MatchResult {
                    tmdb_id,
                    title: item.parsed_title.clone().unwrap_or_default(),
                    year: item.parsed_year.map(|y| y.to_string()),
                    confidence: 100,
                    match_type: crate::modules::tmdb::MatchType::ExactTitle,
                };

                match crate::modules::pipeline::create_or_update_movie_pub(
                    pool, &match_result, &tmdb_client,
                ).await {
                    Ok(movie) => {
                        resolved_entity_id = Some(movie.id);
                        // Create media version + file if we have a file path
                        if let Some(ref file_path) = item.file_path {
                            let file_name = std::path::Path::new(file_path)
                                .file_name()
                                .and_then(|f| f.to_str())
                                .unwrap_or("unknown")
                                .to_string();

                            let lib_id: i64 = sqlx::query_as::<_, (i64,)>(
                                "SELECT id FROM libraries LIMIT 1"
                            )
                            .fetch_optional(pool)
                            .await
                            .map_err(|e| e.to_string())?
                            .map(|(id,)| id)
                            .unwrap_or(0);

                            if lib_id > 0 {
                                let version = crate::db::queries::create_media_version(
                                    pool, "movie", movie.id, None,
                                ).await.map_err(|e| e.to_string())?;

                                let file_size = std::fs::metadata(file_path)
                                    .map(|m| m.len() as i64).unwrap_or(0);
                                crate::db::queries::create_media_file(
                                    pool, version.id, lib_id, file_path, &file_name, Some(file_size),
                                ).await.map_err(|e| e.to_string())?;
                            }
                        }

                        // Cache images (best effort)
                        if let Some(cache) = state.image_cache.read().ok().map(|g| g.clone()) {
                            let _ = crate::modules::image_cache::cache_movie_images(
                                pool, &cache, movie.id,
                            ).await;
                        }

                        resolution_note = format!(
                            "Linked to movie '{}' (TMDB #{})", movie.title, tmdb_id
                        );
                    }
                    Err(e) => {
                        log::warn!("TMDB fetch failed for movie {}: {}", tmdb_id, e);
                        resolution_note = format!("TMDB fetch failed: {}", e);
                    }
                }
            }
            "series" => {
                let match_result = crate::modules::tmdb::MatchResult {
                    tmdb_id,
                    title: item.parsed_title.clone().unwrap_or_default(),
                    year: item.parsed_year.map(|y| y.to_string()),
                    confidence: 100,
                    match_type: crate::modules::tmdb::MatchType::ExactTitle,
                };

                match crate::modules::pipeline::find_or_create_series_pub(
                    pool, &match_result, &tmdb_client,
                ).await {
                    Ok(series) => {
                        resolved_entity_id = Some(series.id);
                        if let Some(cache) = state.image_cache.read().ok().map(|g| g.clone()) {
                            let _ = crate::modules::image_cache::cache_series_images(
                                pool, &cache, series.id,
                            ).await;
                        }
                        resolution_note = format!(
                            "Linked to series '{}' (TMDB #{})", series.title, tmdb_id
                        );
                    }
                    Err(e) => {
                        log::warn!("TMDB fetch failed for series {}: {}", tmdb_id, e);
                        resolution_note = format!("TMDB fetch failed: {}", e);
                    }
                }
            }
            _ => {}
        }
    }

    // Mark inbox item as resolved
    sqlx::query(
        "UPDATE inbox_items SET status = 'resolved', entity_type = ?, entity_id = ?,
         resolution_note = ?, resolved_at = datetime('now'),
         updated_at = datetime('now')
         WHERE id = ?"
    )
    .bind(&entity_type)
    .bind(resolved_entity_id)
    .bind(&resolution_note)
    .bind(inbox_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Ignore an inbox item (exclude from processing)
#[tauri::command]
pub async fn resolve_inbox_ignore(
    state: State<'_, AppState>,
    inbox_id: i64,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();

    sqlx::query(
        "UPDATE inbox_items SET status = 'ignored',
         resolution_note = 'ignored by user', resolved_at = datetime('now'),
         updated_at = datetime('now')
         WHERE id = ?"
    )
    .bind(inbox_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Re-open a resolved/ignored inbox item (set back to pending)
#[tauri::command]
pub async fn reopen_inbox_item(
    state: State<'_, AppState>,
    inbox_id: i64,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();

    sqlx::query(
        "UPDATE inbox_items SET status = 'pending', resolved_at = NULL,
         resolution_note = NULL, updated_at = datetime('now')
         WHERE id = ?"
    )
    .bind(inbox_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete an inbox item permanently
#[tauri::command]
pub async fn delete_inbox_item(
    state: State<'_, AppState>,
    inbox_id: i64,
) -> Result<bool, String> {
    let db = state.db();
    let pool = db.pool();
    let r = sqlx::query("DELETE FROM inbox_items WHERE id = ?")
        .bind(inbox_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(r.rows_affected() > 0)
}

// ============================================================================
// Batch operations
// ============================================================================

/// Preview the impact of a batch operation before executing it
#[tauri::command]
pub async fn batch_preview_inbox(
    state: State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<BatchPreview, String> {
    let db = state.db();
    let pool = db.pool();

    if ids.is_empty() {
        return Ok(BatchPreview {
            total: 0,
            by_status: std::collections::HashMap::new(),
            by_category: std::collections::HashMap::new(),
            items: vec![],
        });
    }

    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "SELECT * FROM inbox_items WHERE id IN ({})",
        placeholders.join(",")
    );

    let mut query = sqlx::query_as::<_, InboxItem>(&sql);
    for id in &ids {
        query = query.bind(id);
    }
    let items = query.fetch_all(pool).await.map_err(|e| e.to_string())?;

    let mut by_status: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    let mut by_category: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
    for item in &items {
        *by_status.entry(item.status.clone()).or_insert(0) += 1;
        *by_category.entry(item.category.clone()).or_insert(0) += 1;
    }

    let preview_items: Vec<BatchPreviewItem> = items
        .iter()
        .map(|i| BatchPreviewItem {
            id: i.id,
            parsed_title: i.parsed_title.clone(),
            category: i.category.clone(),
            status: i.status.clone(),
        })
        .collect();

    Ok(BatchPreview {
        total: items.len() as i64,
        by_status,
        by_category,
        items: preview_items,
    })
}

/// Ignore multiple inbox items at once
#[tauri::command]
pub async fn batch_ignore_inbox(
    state: State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<i64, String> {
    let db = state.db();
    let pool = db.pool();

    if ids.is_empty() {
        return Ok(0);
    }

    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "UPDATE inbox_items SET status = 'ignored', resolution_note = 'ignored by user (batch)',
         resolved_at = datetime('now'), updated_at = datetime('now')
         WHERE id IN ({}) AND status = 'pending'",
        placeholders.join(",")
    );

    let mut query = sqlx::query(&sql);
    for id in &ids {
        query = query.bind(id);
    }
    let r = query.execute(pool).await.map_err(|e| e.to_string())?;
    Ok(r.rows_affected() as i64)
}

/// Reopen multiple resolved/ignored inbox items at once
#[tauri::command]
pub async fn batch_reopen_inbox(
    state: State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<i64, String> {
    let db = state.db();
    let pool = db.pool();

    if ids.is_empty() {
        return Ok(0);
    }

    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "UPDATE inbox_items SET status = 'pending', resolved_at = NULL,
         resolution_note = NULL, updated_at = datetime('now')
         WHERE id IN ({}) AND status != 'pending'",
        placeholders.join(",")
    );

    let mut query = sqlx::query(&sql);
    for id in &ids {
        query = query.bind(id);
    }
    let r = query.execute(pool).await.map_err(|e| e.to_string())?;
    Ok(r.rows_affected() as i64)
}

/// Delete multiple inbox items at once
#[tauri::command]
pub async fn batch_delete_inbox(
    state: State<'_, AppState>,
    ids: Vec<i64>,
) -> Result<i64, String> {
    let db = state.db();
    let pool = db.pool();

    if ids.is_empty() {
        return Ok(0);
    }

    let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
    let sql = format!(
        "DELETE FROM inbox_items WHERE id IN ({})",
        placeholders.join(",")
    );

    let mut query = sqlx::query(&sql);
    for id in &ids {
        query = query.bind(id);
    }
    let r = query.execute(pool).await.map_err(|e| e.to_string())?;
    Ok(r.rows_affected() as i64)
}

// ---- Batch preview types ----

#[derive(serde::Serialize, Clone)]
pub struct BatchPreviewItem {
    pub id: i64,
    pub parsed_title: Option<String>,
    pub category: String,
    pub status: String,
}

#[derive(serde::Serialize, Clone)]
pub struct BatchPreview {
    pub total: i64,
    pub by_status: std::collections::HashMap<String, i64>,
    pub by_category: std::collections::HashMap<String, i64>,
    pub items: Vec<BatchPreviewItem>,
}
