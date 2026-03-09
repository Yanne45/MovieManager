use crate::modules::image_cache::{self, ImageCache};
use crate::modules::tmdb::TmdbImageEntry;
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

// ============================================================================
// Image management commands
// ============================================================================

/// Copy a local image file into the cache and record it in the DB.
/// `image_type` is one of: "poster", "backdrop", "photo", "logo", "still".
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

    let cached = cache
        .copy_local_image(Path::new(&source_path), &entity_type, entity_id, &image_type)
        .map_err(|e| e.to_string())?;

    // Save to images table
    sqlx::query(
        "INSERT INTO images (entity_type, entity_id, image_type, source_url,
         path_thumb, path_medium, path_large)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_type, entity_id, image_type) DO UPDATE SET
         source_url = excluded.source_url,
         path_thumb = excluded.path_thumb,
         path_medium = excluded.path_medium,
         path_large = excluded.path_large,
         updated_at = datetime('now')"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .bind(&image_type)
    .bind("") // no TMDB source
    .bind(&cached.thumbnail)
    .bind(&cached.medium)
    .bind(&cached.large)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Return absolute paths for immediate display
    let root = cache.root().to_path_buf();
    let to_abs = |rel: Option<String>| rel.map(|p| root.join(&p).to_string_lossy().to_string());
    Ok(ImagePaths {
        thumbnail: to_abs(cached.thumbnail),
        medium: to_abs(cached.medium),
        large: to_abs(cached.large),
    })
}

/// Re-download images from TMDB for any entity type.
/// Looks up the entity's TMDB paths and re-runs the appropriate cache function.
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
        _ => return Err(format!("Unknown entity type: {}", entity_type)),
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
    /// TMDB path (e.g. "/abc123.jpg") — pass to import_tmdb_image to download
    pub tmdb_path: String,
    /// "poster", "backdrop", "photo", "logo"
    pub image_type: String,
    /// Direct TMDB preview URL (w342) — for <img> in the picker
    pub preview_url: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub vote_average: Option<f64>,
}

/// List available images from TMDB for a given entity (for the image picker).
/// `entity_type`: "movie" | "series" | "person"
/// `tmdb_id`: the TMDB ID of the entity
#[tauri::command]
pub async fn get_tmdb_image_candidates(
    state: State<'_, AppState>,
    entity_type: String,
    tmdb_id: i64,
) -> Result<Vec<TmdbImageCandidate>, String> {
    let tmdb = state.get_tmdb().ok_or("TMDB API key not configured")?;
    const BASE: &str = "https://image.tmdb.org/t/p/w342";

    let mut candidates: Vec<TmdbImageCandidate> = Vec::new();

    let entries_to_candidates = |entries: Vec<TmdbImageEntry>, img_type: &str| -> Vec<TmdbImageCandidate> {
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
/// Called when the user selects an image from the TMDB picker.
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

    let img_type = match image_type.as_str() {
        "poster" => image_cache::ImageType::Poster,
        "backdrop" => image_cache::ImageType::Backdrop,
        "photo" => image_cache::ImageType::Photo,
        "logo" => image_cache::ImageType::Logo,
        "still" => image_cache::ImageType::Still,
        other => return Err(format!("Unknown image type: {}", other)),
    };

    let cached = cache.download_image(&tmdb_path, img_type).await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO images (entity_type, entity_id, image_type, source_url,
         path_thumb, path_medium, path_large)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(entity_type, entity_id, image_type) DO UPDATE SET
         source_url = excluded.source_url,
         path_thumb = excluded.path_thumb,
         path_medium = excluded.path_medium,
         path_large = excluded.path_large,
         updated_at = datetime('now')"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .bind(&image_type)
    .bind(&cached.tmdb_path)
    .bind(&cached.thumbnail)
    .bind(&cached.medium)
    .bind(&cached.large)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let root = cache.root().to_path_buf();
    let to_abs = |rel: Option<String>| rel.map(|p| root.join(&p).to_string_lossy().to_string());
    Ok(ImagePaths {
        thumbnail: to_abs(cached.thumbnail),
        medium: to_abs(cached.medium),
        large: to_abs(cached.large),
    })
}

/// Delete the cached image for an entity+type (removes from DB and disk).
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

    // Fetch paths before deleting
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

    // Delete DB record
    sqlx::query(
        "DELETE FROM images WHERE entity_type = ? AND entity_id = ? AND image_type = ?"
    )
    .bind(&entity_type)
    .bind(entity_id)
    .bind(&image_type)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Delete files
    if let Some((t, m, l)) = row {
        let root = cache.root();
        for rel in [t, m, l].into_iter().flatten() {
            let _ = std::fs::remove_file(root.join(&rel));
        }
    }

    Ok(())
}
