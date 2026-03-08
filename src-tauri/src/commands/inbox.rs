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
    let filter = status.as_deref().unwrap_or("pending");

    let items = sqlx::query_as::<_, InboxItem>(
        "SELECT * FROM inbox_items WHERE status = ? ORDER BY created_at DESC"
    )
    .bind(filter)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

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
    entity_id: i64, // This is actually the TMDB ID from the search
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
    .ok_or_else(|| format!("Inbox item {} not found", inbox_id))?;

    let tmdb_id = entity_id;
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
    .bind(entity_id)
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
