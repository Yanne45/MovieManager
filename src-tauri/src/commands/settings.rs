use crate::db::{models::ScoreWeights, queries};
use crate::modules::media_analysis;
use crate::AppState;
use tauri::State;

const SCORE_WEIGHTS_KEY: &str = "score_weights";

/// Return the current score weights (defaults if not yet saved)
#[tauri::command]
pub async fn get_score_weights(state: State<'_, AppState>) -> Result<ScoreWeights, String> {
    let db = state.db();
    let pool = db.pool();
    match queries::get_setting(pool, SCORE_WEIGHTS_KEY).await {
        Ok(Some(json)) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        Ok(None) => Ok(ScoreWeights::default()),
        Err(e) => Err(e.to_string()),
    }
}

/// Persist new score weights
#[tauri::command]
pub async fn set_score_weights(
    state: State<'_, AppState>,
    weights: ScoreWeights,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();
    let json = serde_json::to_string(&weights).map_err(|e| e.to_string())?;
    queries::set_setting(pool, SCORE_WEIGHTS_KEY, &json)
        .await
        .map_err(|e| e.to_string())
}

/// Recompute quality scores for all media versions using stored technical data
/// (no FFprobe needed — uses resolution/codec/bitrate/etc. already in DB)
#[tauri::command]
pub async fn recompute_all_scores(state: State<'_, AppState>) -> Result<usize, String> {
    let db = state.db();
    let pool = db.pool();

    // Load current weights
    let weights: ScoreWeights = match queries::get_setting(pool, SCORE_WEIGHTS_KEY).await {
        Ok(Some(json)) => serde_json::from_str(&json).unwrap_or_default(),
        _ => ScoreWeights::default(),
    };

    // Fetch all versions that have at least some technical metadata
    let versions: Vec<(i64, Option<String>, Option<String>, Option<i64>, Option<String>, Option<String>, Option<String>, String, i64)> =
        sqlx::query_as(
            "SELECT mv.id, mv.resolution, mv.video_codec, mv.video_bitrate,
                    mv.audio_codec, mv.audio_channels, mv.hdr_format,
                    mv.owner_type, mv.owner_id
             FROM media_versions mv
             WHERE mv.resolution IS NOT NULL OR mv.video_codec IS NOT NULL",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut count = 0usize;

    for (id, resolution, video_codec, video_bitrate, audio_codec, audio_channels, hdr_format, owner_type, owner_id) in &versions {
        let new_score = media_analysis::compute_score_from_stored(
            resolution.as_deref(),
            video_codec.as_deref(),
            *video_bitrate,
            audio_codec.as_deref(),
            audio_channels.as_deref(),
            hdr_format.is_some(),
            &weights,
        );

        sqlx::query(
            "UPDATE media_versions SET quality_score = ?, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(&new_score)
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

        // Keep movie's primary_quality_score in sync
        if owner_type == "movie" {
            sqlx::query(
                "UPDATE movies SET primary_quality_score = ?, updated_at = datetime('now') WHERE id = ?",
            )
            .bind(&new_score)
            .bind(owner_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
        }

        count += 1;
    }

    log::info!("recompute_all_scores: updated {} versions", count);
    Ok(count)
}
