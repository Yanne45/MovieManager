//! Image cache module
//!
//! - Downloads images from TMDB (posters, backdrops, stills)
//! - Stores them locally in 3 sizes: thumbnail, medium, large
//! - Manages cache directory structure
//! - Returns local paths for UI consumption
//! - Tracks images in the `images` DB table

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

// ============================================================================
// Config
// ============================================================================

/// Image size presets (matching TMDB w-sizes and local cache)
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ImageSize {
    Thumbnail, // w92  — table rows
    Medium,    // w342 — detail panel
    Large,     // w500 — gallery view
}

impl ImageSize {
    pub fn tmdb_size(&self) -> &str {
        match self {
            ImageSize::Thumbnail => "w92",
            ImageSize::Medium => "w342",
            ImageSize::Large => "w500",
        }
    }

    pub fn dir_name(&self) -> &str {
        match self {
            ImageSize::Thumbnail => "thumb",
            ImageSize::Medium => "medium",
            ImageSize::Large => "large",
        }
    }

    pub fn all() -> &'static [ImageSize] {
        &[ImageSize::Thumbnail, ImageSize::Medium, ImageSize::Large]
    }
}

const TMDB_IMAGE_BASE: &str = "https://image.tmdb.org/t/p";

/// Image types for organizing the cache
#[derive(Debug, Clone, Copy)]
pub enum ImageType {
    Poster,
    Backdrop,
    Still,
    Photo,
}

impl ImageType {
    pub fn dir_name(&self) -> &str {
        match self {
            ImageType::Poster => "posters",
            ImageType::Backdrop => "backdrops",
            ImageType::Still => "stills",
            ImageType::Photo => "photos",
        }
    }
}

// ============================================================================
// Cache manager
// ============================================================================

pub struct ImageCache {
    http: Client,
    cache_root: PathBuf,
}

impl ImageCache {
    /// Create a new image cache rooted at the given directory
    pub fn new(cache_root: &Path) -> Self {
        Self {
            http: Client::new(),
            cache_root: cache_root.to_path_buf(),
        }
    }

    /// Get the cache root path
    pub fn root(&self) -> &Path {
        &self.cache_root
    }

    /// Ensure all cache subdirectories exist
    pub fn ensure_dirs(&self) -> Result<()> {
        for img_type in &[ImageType::Poster, ImageType::Backdrop, ImageType::Still, ImageType::Photo] {
            for size in ImageSize::all() {
                let dir = self.cache_root
                    .join(img_type.dir_name())
                    .join(size.dir_name());
                std::fs::create_dir_all(&dir)
                    .with_context(|| format!("Failed to create cache dir: {:?}", dir))?;
            }
        }
        Ok(())
    }

    /// Download a TMDB image in all 3 sizes and return local paths
    ///
    /// Returns (thumb_path, medium_path, large_path) relative to cache_root
    pub async fn download_image(
        &self,
        tmdb_path: &str,
        image_type: ImageType,
    ) -> Result<CachedImage> {
        // Derive filename from TMDB path (e.g. "/abc123.jpg" → "abc123.jpg")
        let filename = tmdb_path
            .trim_start_matches('/')
            .to_string();

        let mut result = CachedImage {
            tmdb_path: tmdb_path.to_string(),
            thumbnail: None,
            medium: None,
            large: None,
        };

        for size in ImageSize::all() {
            let local_dir = self.cache_root
                .join(image_type.dir_name())
                .join(size.dir_name());
            let local_path = local_dir.join(&filename);

            // Skip if already cached
            if local_path.exists() {
                let rel = self.relative_path(&local_path);
                match size {
                    ImageSize::Thumbnail => result.thumbnail = Some(rel),
                    ImageSize::Medium => result.medium = Some(rel),
                    ImageSize::Large => result.large = Some(rel),
                }
                continue;
            }

            // Download
            let url = format!("{}/{}{}", TMDB_IMAGE_BASE, size.tmdb_size(), tmdb_path);
            match self.download_to(&url, &local_path).await {
                Ok(_) => {
                    let rel = self.relative_path(&local_path);
                    match size {
                        ImageSize::Thumbnail => result.thumbnail = Some(rel),
                        ImageSize::Medium => result.medium = Some(rel),
                        ImageSize::Large => result.large = Some(rel),
                    }
                }
                Err(e) => {
                    log::warn!("Failed to download {} ({}): {}", url, size.tmdb_size(), e);
                }
            }
        }

        Ok(result)
    }

    /// Download a single URL to a local file
    async fn download_to(&self, url: &str, dest: &Path) -> Result<()> {
        let response = self.http
            .get(url)
            .send()
            .await
            .with_context(|| format!("Failed to fetch {}", url))?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!(
                "HTTP {} for {}",
                response.status(),
                url
            ));
        }

        let bytes = response.bytes().await?;

        // Ensure parent dir
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }

        std::fs::write(dest, &bytes)
            .with_context(|| format!("Failed to write {:?}", dest))?;

        Ok(())
    }

    /// Get path relative to cache root
    fn relative_path(&self, path: &Path) -> String {
        path.strip_prefix(&self.cache_root)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
    }
}

/// Result of caching an image in all sizes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedImage {
    pub tmdb_path: String,
    pub thumbnail: Option<String>,
    pub medium: Option<String>,
    pub large: Option<String>,
}

// ============================================================================
// DB integration
// ============================================================================

/// Cache all images for a movie and update DB
pub async fn cache_movie_images(
    pool: &SqlitePool,
    cache: &ImageCache,
    movie_id: i64,
) -> Result<()> {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT poster_path, backdrop_path FROM movies WHERE id = ?"
    )
    .bind(movie_id)
    .fetch_optional(pool)
    .await?;

    let Some((poster_path, backdrop_path)) = row else { return Ok(()) };

    if let Some(ref p) = poster_path {
        let cached = cache.download_image(p, ImageType::Poster).await?;
        save_image_record(pool, "movie", movie_id, "poster", &cached).await?;
    }

    if let Some(ref b) = backdrop_path {
        let cached = cache.download_image(b, ImageType::Backdrop).await?;
        save_image_record(pool, "movie", movie_id, "backdrop", &cached).await?;
    }

    Ok(())
}

/// Cache all images for a series (poster + backdrop + season posters)
pub async fn cache_series_images(
    pool: &SqlitePool,
    cache: &ImageCache,
    series_id: i64,
) -> Result<()> {
    // Series poster + backdrop
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT poster_path, backdrop_path FROM series WHERE id = ?"
    )
    .bind(series_id)
    .fetch_optional(pool)
    .await?;

    if let Some((poster_path, backdrop_path)) = row {
        if let Some(ref p) = poster_path {
            let cached = cache.download_image(p, ImageType::Poster).await?;
            save_image_record(pool, "series", series_id, "poster", &cached).await?;
        }
        if let Some(ref b) = backdrop_path {
            let cached = cache.download_image(b, ImageType::Backdrop).await?;
            save_image_record(pool, "series", series_id, "backdrop", &cached).await?;
        }
    }

    // Season posters
    let seasons: Vec<(i64, Option<String>)> = sqlx::query_as(
        "SELECT id, poster_path FROM seasons WHERE series_id = ?"
    )
    .bind(series_id)
    .fetch_all(pool)
    .await?;

    for (season_id, poster_path) in seasons {
        if let Some(ref p) = poster_path {
            let cached = cache.download_image(p, ImageType::Poster).await?;
            save_image_record(pool, "season", season_id, "poster", &cached).await?;
        }
    }

    Ok(())
}

/// Save an image record to the images table
async fn save_image_record(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    image_type: &str,
    cached: &CachedImage,
) -> Result<()> {
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
    .bind(entity_type)
    .bind(entity_id)
    .bind(image_type)
    .bind(&cached.tmdb_path)
    .bind(&cached.thumbnail)
    .bind(&cached.medium)
    .bind(&cached.large)
    .execute(pool)
    .await?;

    Ok(())
}

/// Get cached image paths for an entity
pub async fn get_entity_images(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
) -> Result<Vec<ImageRecord>> {
    let rows = sqlx::query_as::<_, ImageRecord>(
        "SELECT * FROM images WHERE entity_type = ? AND entity_id = ?"
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ImageRecord {
    pub id: i64,
    pub entity_type: String,
    pub entity_id: i64,
    pub image_type: String,
    pub source_url: Option<String>,
    pub path_thumb: Option<String>,
    pub path_medium: Option<String>,
    pub path_large: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Purge orphaned images (images in cache dir not referenced in DB)
pub async fn purge_orphaned(pool: &SqlitePool, cache: &ImageCache) -> Result<usize> {
    let mut purged = 0;

    // Get all referenced paths from DB
    let db_paths: Vec<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT path_thumb, path_medium, path_large FROM images"
    )
    .fetch_all(pool)
    .await?;

    let mut referenced: std::collections::HashSet<String> = std::collections::HashSet::new();
    for (t, m, l) in &db_paths {
        if let Some(p) = t { referenced.insert(p.clone()); }
        if let Some(p) = m { referenced.insert(p.clone()); }
        if let Some(p) = l { referenced.insert(p.clone()); }
    }

    // Walk cache directory
    for entry in walkdir::WalkDir::new(cache.root())
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let rel = entry.path()
            .strip_prefix(cache.root())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if !referenced.contains(&rel) {
            if std::fs::remove_file(entry.path()).is_ok() {
                purged += 1;
            }
        }
    }

    log::info!("Purged {} orphaned images from cache", purged);
    Ok(purged)
}
