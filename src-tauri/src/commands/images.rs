use crate::modules::image_cache::{self, ImageType};
use crate::AppState;
use serde::Serialize;
use sqlx;
use std::path::Path;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ImagePaths {
    pub thumbnail: Option<String>,
    pub medium: Option<String>,
    pub large: Option<String>,
}

/// Get cached image paths for an entity (returns absolute filesystem paths)
/// For single types (poster/logo), returns the one image.
/// For multi types, returns the first image (position=0).
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
         WHERE entity_type = ? AND entity_id = ? AND image_type = ?
         ORDER BY position ASC LIMIT 1"
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

/// Get the image cache root directory
#[tauri::command]
pub async fn get_image_cache_root(state: State<'_, AppState>) -> Result<String, String> {
    let cache = state.image_cache.read().map_err(|e| e.to_string())?;
    Ok(cache.root().to_string_lossy().to_string())
}

// ============================================================================
// Multi-image queries
// ============================================================================

/// Get ALL images for an entity, ordered by type then position.
/// Returns absolute paths for immediate display.
#[tauri::command]
pub async fn get_all_entity_images(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
) -> Result<Vec<ImageRecordResponse>, String> {
    let db = state.db();
    let pool = db.pool();
    let root = {
        let cache = state.image_cache.read().map_err(|e| e.to_string())?;
        cache.root().to_path_buf()
    };

    let records = image_cache::get_entity_images(pool, &entity_type, entity_id)
        .await.map_err(|e| e.to_string())?;

    Ok(records.into_iter().map(|r| ImageRecordResponse::from_record(r, &root)).collect())
}

/// Get images of a specific type for an entity, ordered by position.
#[tauri::command]
pub async fn get_entity_images_by_type(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
    image_type: String,
) -> Result<Vec<ImageRecordResponse>, String> {
    let db = state.db();
    let pool = db.pool();
    let root = {
        let cache = state.image_cache.read().map_err(|e| e.to_string())?;
        cache.root().to_path_buf()
    };

    let records = image_cache::get_entity_images_by_type(pool, &entity_type, entity_id, &image_type)
        .await.map_err(|e| e.to_string())?;

    Ok(records.into_iter().map(|r| ImageRecordResponse::from_record(r, &root)).collect())
}

/// Response type for image records with absolute paths
#[derive(Debug, Serialize)]
pub struct ImageRecordResponse {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub image_type: String,
    pub source_url: Option<String>,
    pub path_thumb: Option<String>,
    pub path_medium: Option<String>,
    pub path_large: Option<String>,
    pub position: i64,
    pub entity_slug: String,
}

impl ImageRecordResponse {
    fn from_record(r: image_cache::ImageRecord, root: &std::path::Path) -> Self {
        let to_abs = |rel: Option<String>| -> Option<String> {
            rel.map(|p| root.join(&p).to_string_lossy().to_string())
        };
        Self {
            id: r.id,
            entity_type: r.entity_type,
            entity_id: r.entity_id,
            image_type: r.image_type,
            source_url: r.source_url,
            path_thumb: to_abs(r.path_thumb),
            path_medium: to_abs(r.path_medium),
            path_large: to_abs(r.path_large),
            position: r.position,
            entity_slug: r.entity_slug,
        }
    }
}

// ============================================================================
// Image management commands
// ============================================================================

/// Copy a local image file into the cache and record it in the DB.
/// For single types (poster/logo/thumbnail): replaces existing.
/// For multi types (backdrop/photo/still/banner): adds a new image.
#[tauri::command]
pub async fn import_local_image(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
    image_type: String,
    source_path: String,
) -> Result<ImagePaths, String> {
    let db = state.db();
    let pool = db.pool();
    let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();

    let slug = image_cache::resolve_entity_slug(pool, &entity_type, entity_id)
        .await.map_err(|e| e.to_string())?;

    let position = if image_cache::is_single_image_type(&image_type) {
        0
    } else {
        image_cache::next_position(pool, &entity_type, entity_id, &image_type)
            .await.map_err(|e| e.to_string())?
    };

    let cached = cache
        .copy_local_image(Path::new(&source_path), &slug, entity_id, position)
        .map_err(|e| e.to_string())?;

    image_cache::save_image_record(pool, &entity_type, entity_id, &image_type, &cached, position, &slug)
        .await.map_err(|e| e.to_string())?;

    let root = cache.root().to_path_buf();
    let to_abs = |rel: Option<String>| rel.map(|p| root.join(&p).to_string_lossy().to_string());
    Ok(ImagePaths {
        thumbnail: to_abs(cached.thumbnail),
        medium: to_abs(cached.medium),
        large: to_abs(cached.large),
    })
}

/// Re-download images from TMDB for any entity type.
#[tauri::command]
pub async fn refresh_entity_images(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();
    let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();

    match entity_type.as_str() {
        "movie" => {
            image_cache::cache_movie_images(pool, &cache, entity_id)
                .await.map_err(|e| e.to_string())?;
        }
        "series" => {
            image_cache::cache_series_images(pool, &cache, entity_id)
                .await.map_err(|e| e.to_string())?;
        }
        "person" => {
            image_cache::cache_person_images(pool, &cache, entity_id)
                .await.map_err(|e| e.to_string())?;
        }
        "studio" => {
            image_cache::cache_studio_images(pool, &cache, entity_id)
                .await.map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("Type d'entité inconnu : {}", entity_type)),
    }
    Ok(())
}

/// Remove unused image files from the cache directory.
#[tauri::command]
pub async fn purge_orphaned_images(state: State<'_, AppState>) -> Result<usize, String> {
    let db = state.db();
    let pool = db.pool();
    let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();
    image_cache::purge_orphaned(pool, &cache)
        .await.map_err(|e| e.to_string())
}

/// Image candidate returned to the frontend for the picker
#[derive(Debug, Serialize)]
pub struct TmdbImageCandidate {
    pub tmdb_path: String,
    pub image_type: String,
    pub preview_url: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub vote_average: Option<f64>,
}

/// List available images from TMDB for a given entity (for the image picker).
#[tauri::command]
pub async fn get_tmdb_image_candidates(
    state: State<'_, AppState>,
    entity_type: String,
    tmdb_id: i64,
) -> Result<Vec<TmdbImageCandidate>, String> {
    let tmdb = state.get_tmdb().ok_or("TMDB API key not configured")?;
    const BASE: &str = "https://image.tmdb.org/t/p/w342";

    let mut candidates: Vec<TmdbImageCandidate> = Vec::new();

    let entries_to_candidates = |entries: Vec<crate::modules::tmdb::TmdbImageEntry>, img_type: &str| -> Vec<TmdbImageCandidate> {
        entries.into_iter().map(|e| TmdbImageCandidate {
            preview_url: format!("{}{}", BASE, e.file_path),
            tmdb_path: e.file_path,
            image_type: img_type.to_string(),
            width: e.width,
            height: e.height,
            vote_average: e.vote_average,
        }).collect()
    };

    match entity_type.as_str() {
        "movie" => {
            let list = tmdb.get_movie_images(tmdb_id).await.map_err(|e| e.to_string())?;
            candidates.extend(entries_to_candidates(list.posters, "poster"));
            candidates.extend(entries_to_candidates(list.backdrops, "backdrop"));
        }
        "series" => {
            let list = tmdb.get_series_images(tmdb_id).await.map_err(|e| e.to_string())?;
            candidates.extend(entries_to_candidates(list.posters, "poster"));
            candidates.extend(entries_to_candidates(list.backdrops, "backdrop"));
        }
        "person" => {
            let list = tmdb.get_person_images(tmdb_id).await.map_err(|e| e.to_string())?;
            candidates.extend(entries_to_candidates(list.profiles, "photo"));
        }
        _ => return Err(format!("Unsupported entity type: {}", entity_type)),
    }

    Ok(candidates)
}

/// Download a specific TMDB image and set it as the entity's image.
/// For single types: replaces. For multi types: adds.
#[tauri::command]
pub async fn apply_tmdb_image(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
    image_type: String,
    tmdb_path: String,
) -> Result<ImagePaths, String> {
    let db = state.db();
    let pool = db.pool();
    let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();

    let img_type = ImageType::from_str(&image_type)
        .ok_or_else(|| format!("Unknown image type: {}", image_type))?;

    let slug = image_cache::resolve_entity_slug(pool, &entity_type, entity_id)
        .await.map_err(|e| e.to_string())?;

    let position = if image_cache::is_single_image_type(&image_type) {
        0
    } else {
        image_cache::next_position(pool, &entity_type, entity_id, &image_type)
            .await.map_err(|e| e.to_string())?
    };

    let cached = cache.download_image(&tmdb_path, img_type, &slug, entity_id, position)
        .await.map_err(|e| e.to_string())?;

    image_cache::save_image_record(pool, &entity_type, entity_id, &image_type, &cached, position, &slug)
        .await.map_err(|e| e.to_string())?;

    let root = cache.root().to_path_buf();
    let to_abs = |rel: Option<String>| rel.map(|p| root.join(&p).to_string_lossy().to_string());
    Ok(ImagePaths {
        thumbnail: to_abs(cached.thumbnail),
        medium: to_abs(cached.medium),
        large: to_abs(cached.large),
    })
}

/// Delete a single image by its DB id (removes from DB and disk).
#[tauri::command]
pub async fn delete_image_by_id(
    state: State<'_, AppState>,
    image_id: i64,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();
    let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();
    image_cache::delete_image_by_id(pool, &cache, image_id)
        .await.map_err(|e| e.to_string())
}

/// Delete the cached image for an entity+type (legacy — deletes all images of that type).
#[tauri::command]
pub async fn delete_entity_image(
    state: State<'_, AppState>,
    entity_type: String,
    entity_id: i64,
    image_type: String,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();
    let cache = state.image_cache.read().map_err(|e| e.to_string())?.clone();

    let records = image_cache::get_entity_images_by_type(pool, &entity_type, entity_id, &image_type)
        .await.map_err(|e| e.to_string())?;

    for r in records {
        image_cache::delete_image_by_id(pool, &cache, r.id)
            .await.map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Reorder images — accepts image IDs in desired order, updates positions.
#[tauri::command]
pub async fn reorder_entity_images(
    state: State<'_, AppState>,
    image_ids: Vec<i64>,
) -> Result<(), String> {
    let db = state.db();
    let pool = db.pool();
    image_cache::reorder_images(pool, &image_ids)
        .await.map_err(|e| e.to_string())
}
