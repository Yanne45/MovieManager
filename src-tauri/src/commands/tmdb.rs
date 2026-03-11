use crate::modules::change_log::{self, ChangeSource};
use crate::modules::tmdb::{TmdbClient, TmdbMovieSearchResult, TmdbSeriesSearchResult};
use crate::AppState;
use tauri::State;
use sqlx;

#[tauri::command]
pub async fn search_movie_tmdb(
    state: State<'_, AppState>,
    query: String,
    year: Option<i64>,
) -> Result<Vec<TmdbMovieSearchResult>, String> {
    let client = state
        .get_tmdb()
        .ok_or_else(|| "TMDB API key not configured. Set it in Settings > API Keys.".to_string())?;

    client
        .search_movies(&query, year)
        .await
        .map_err(|e| format!("TMDB search failed: {}", e))
}

#[tauri::command]
pub async fn search_series_tmdb(
    state: State<'_, AppState>,
    query: String,
    year: Option<i64>,
) -> Result<Vec<TmdbSeriesSearchResult>, String> {
    let client = state
        .get_tmdb()
        .ok_or_else(|| "TMDB API key not configured. Set it in Settings > API Keys.".to_string())?;

    client
        .search_series(&query, year)
        .await
        .map_err(|e| format!("TMDB search failed: {}", e))
}

#[tauri::command]
pub async fn set_tmdb_api_key(
    state: State<'_, AppState>,
    api_key: String,
    language: Option<String>,
) -> Result<(), String> {
    let lang = language.unwrap_or_else(|| "fr-FR".to_string());
    let client = TmdbClient::new(&api_key, &lang);

    // Validate by making a test request
    client
        .search_movies("test", None)
        .await
        .map_err(|e| format!("Invalid API key: {}", e))?;

    // Store in state
    let mut guard = state
        .tmdb
        .write()
        .map_err(|e| format!("Lock error: {}", e))?;
    *guard = Some(client);

    log::info!("TMDB API key updated successfully");
    Ok(())
}

/// Sync episode metadata (title, overview, air_date, runtime, tmdb_id) from TMDB
/// for all seasons of a given series. Returns number of episodes updated.
#[tauri::command]
pub async fn sync_episodes_from_tmdb(
    state: State<'_, AppState>,
    series_id: i64,
) -> Result<usize, String> {
    let client = state
        .get_tmdb()
        .ok_or_else(|| "TMDB API key not configured. Set it in Settings > API Keys.".to_string())?;

    let db = state.db();
    let pool = db.pool();

    // Get the series tmdb_id
    let series_tmdb_id: Option<i64> = sqlx::query_scalar(
        "SELECT tmdb_id FROM series WHERE id = ?"
    )
    .bind(series_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .flatten();

    let tmdb_id = series_tmdb_id
        .ok_or_else(|| "Series has no TMDB ID — search and link it first.".to_string())?;

    // Fetch all seasons for this series
    let seasons: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT id, season_number FROM seasons WHERE series_id = ? ORDER BY season_number"
    )
    .bind(series_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut updated = 0usize;
    let op_id = change_log::new_operation_id();

    for (season_id, season_number) in seasons {
        let detail = match client.get_season(tmdb_id, season_number).await {
            Ok(d) => d,
            Err(e) => {
                log::warn!("TMDB season {season_number} fetch failed: {e}");
                continue;
            }
        };

        let episodes = detail.episodes.unwrap_or_default();

        for ep in &episodes {
            // Get current state for change tracking
            let before: Option<(i64, Option<String>, Option<String>)> = sqlx::query_as(
                "SELECT id, title, overview FROM episodes WHERE season_id = ? AND episode_number = ?"
            )
            .bind(season_id)
            .bind(ep.episode_number)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

            let rows = sqlx::query(
                "UPDATE episodes
                 SET title = COALESCE(?, title),
                     overview = COALESCE(?, overview),
                     air_date = COALESCE(?, air_date),
                     runtime = COALESCE(?, runtime),
                     tmdb_id = COALESCE(?, tmdb_id),
                     updated_at = datetime('now')
                 WHERE season_id = ? AND episode_number = ?"
            )
            .bind(&ep.name)
            .bind(&ep.overview)
            .bind(&ep.air_date)
            .bind(ep.runtime)
            .bind(ep.id)
            .bind(season_id)
            .bind(ep.episode_number)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

            if rows.rows_affected() > 0 {
                if let Some((episode_id, old_title, _old_overview)) = before {
                    if let Some(new_title) = &ep.name {
                        change_log::record_change_op(
                            pool, "episode", episode_id, "title",
                            old_title.as_deref(), Some(new_title),
                            ChangeSource::Tmdb, Some(&op_id),
                        ).await.ok();
                    }
                }
            }

            updated += rows.rows_affected() as usize;
        }

        log::info!(
            "sync_episodes_from_tmdb: season {} — {} episodes synced",
            season_number,
            episodes.len()
        );
    }

    log::info!("sync_episodes_from_tmdb: series {} total {} updated", series_id, updated);
    Ok(updated)
}
