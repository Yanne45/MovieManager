use crate::AppState;
use serde::Serialize;
use sqlx;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ImagePaths {
    pub thumbnail: Option<String>,
    pub medium: Option<String>,
    pub large: Option<String>,
}

/// Get cached image paths for an entity (returns absolute filesystem paths)
/// Frontend uses convertFileSrc() to make them displayable.
#[tauri::command]
pub async fn get_image_paths(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
    image_type: String,
) -> Result<Option<ImagePaths>, String> {
    let db = state.db();
    let pool = db.pool();

    let row: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT path_thumb, path_medium, path_large FROM images
         WHERE entity_type = ? AND entity_id = ? AND image_type = ?"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .bind(&image_type)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    let Some((thumb, medium, large)) = row else {
        return Ok(None);
    };

    // Convert relative paths to absolute paths using image cache root
    let cache = state.image_cache.read().map_err(|e| e.to_string())?;
    let root = cache.root();

    let to_abs = |rel: Option<String>| -> Option<String> {
        rel.map(|p| root.join(&p).to_string_lossy().to_string())
    };

    Ok(Some(ImagePaths {
        thumbnail: to_abs(thumb),
        medium: to_abs(medium),
        large: to_abs(large),
    }))
}

/// Get the image cache root directory (frontend can build paths from this)
#[tauri::command]
pub async fn get_image_cache_root(state: State<'_, AppState>) -> Result<String, String> {
    let cache = state.image_cache.read().map_err(|e| e.to_string())?;
    Ok(cache.root().to_string_lossy().to_string())
}
