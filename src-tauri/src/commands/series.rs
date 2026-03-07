use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;
use sqlx;

#[tauri::command]
pub async fn get_series_list(state: State<'_, AppState>) -> Result<Vec<SeriesListItem>, String> {
    let pool = state.db().pool();

    // Get all series
    let all_series = queries::get_series_list(pool)
        .await
        .map_err(|e| e.to_string())?;

    if all_series.is_empty() {
        return Ok(Vec::new());
    }

    // Get completeness stats for ALL series in one query
    let stats: Vec<(i64, i64, i64)> = sqlx::query_as(
        "SELECT series_id,
                COUNT(*) as total,
                SUM(CASE WHEN has_file = 1 THEN 1 ELSE 0 END) as owned
         FROM episodes
         GROUP BY series_id"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Build a lookup map
    let stats_map: std::collections::HashMap<i64, (i64, i64)> = stats
        .into_iter()
        .map(|(sid, total, owned)| (sid, (total, owned)))
        .collect();

    let items = all_series
        .into_iter()
        .map(|s| {
            let (total, owned) = stats_map.get(&s.id).copied().unwrap_or((0, 0));
            let pct = if total > 0 {
                (owned as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            SeriesListItem {
                series: s,
                owned_episodes: owned,
                completeness_percent: pct,
            }
        })
        .collect();

    Ok(items)
}

#[tauri::command]
pub async fn get_series_detail(
    state: State<'_, AppState>,
    id: i64,
) -> Result<Option<SeriesDetail>, String> {
    let pool = state.db().pool();
    let series = queries::get_series(pool, id)
        .await
        .map_err(|e| e.to_string())?;

    let Some(series) = series else { return Ok(None) };

    let seasons = queries::get_seasons(pool, id)
        .await
        .map_err(|e| e.to_string())?;

    // Fetch ALL episodes for this series in one query (avoid N+1 per season)
    let all_episodes: Vec<Episode> = sqlx::query_as(
        "SELECT * FROM episodes WHERE series_id = ? ORDER BY season_id, episode_number"
    )
    .bind(id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut total_owned: i64 = 0;
    let mut total_episodes: i64 = 0;

    let season_details: Vec<SeasonDetail> = seasons
        .into_iter()
        .map(|season| {
            let episodes: Vec<Episode> = all_episodes
                .iter()
                .filter(|e| e.season_id == season.id)
                .cloned()
                .collect();

            let owned_count = episodes.iter().filter(|e| e.has_file).count() as i64;
            total_owned += owned_count;
            total_episodes += episodes.len() as i64;

            SeasonDetail {
                season,
                episodes,
                owned_count,
            }
        })
        .collect();

    Ok(Some(SeriesDetail {
        series,
        seasons: season_details,
        owned_episodes: total_owned,
        total_episode_count: total_episodes,
    }))
}

#[tauri::command]
pub async fn update_series(
    state: State<'_, AppState>,
    id: i64,
    input: UpdateSeries,
) -> Result<Option<Series>, String> {
    queries::update_series(state.db().pool(), id, &input)
        .await
        .map_err(|e| e.to_string())
}
