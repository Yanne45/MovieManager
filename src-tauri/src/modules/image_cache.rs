//! Image cache module
//!
//! - Downloads images from TMDB (posters, backdrops, stills)
//! - Stores them locally in 3 sizes: thumbnail, medium, large
//! - Manages cache directory structure
//! - Returns local paths for UI consumption
//! - Tracks images in the `images` DB table
//! - Supports multi-image galleries (backdrop, photo, still, banner)
//! - Names files using slugified entity name + position

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

// ============================================================================
// Slugify
// ============================================================================

/// Convert an entity name to a filesystem-safe slug.
/// "Inception" → "inception", "The Dark Knight" → "the_dark_knight",
/// "L'Arnacoeur" → "l_arnacoeur", "Amélie" → "amelie"
pub fn slugify(name: &str) -> String {
    let lower = name.to_lowercase();
    let mut result = String::with_capacity(lower.len());
    for ch in lower.chars() {
        match ch {
            'a'..='z' | '0'..='9' => result.push(ch),
            'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' => result.push('a'),
            'è' | 'é' | 'ê' | 'ë' => result.push('e'),
            'ì' | 'í' | 'î' | 'ï' => result.push('i'),
            'ò' | 'ó' | 'ô' | 'õ' | 'ö' => result.push('o'),
            'ù' | 'ú' | 'û' | 'ü' => result.push('u'),
            'ý' | 'ÿ' => result.push('y'),
            'ñ' => result.push('n'),
            'ç' => result.push('c'),
            'æ' => { result.push('a'); result.push('e'); }
            'œ' => { result.push('o'); result.push('e'); }
            'ß' => { result.push('s'); result.push('s'); }
            'ð' => result.push('d'),
            'þ' => { result.push('t'); result.push('h'); }
            _ => result.push('_'),
        }
    }
    // Collapse consecutive underscores and trim
    let mut collapsed = String::with_capacity(result.len());
    let mut prev_underscore = true; // trim leading
    for ch in result.chars() {
        if ch == '_' {
            if !prev_underscore { collapsed.push('_'); }
            prev_underscore = true;
        } else {
            collapsed.push(ch);
            prev_underscore = false;
        }
    }
    // Trim trailing underscore
    while collapsed.ends_with('_') {
        collapsed.pop();
    }
    // Truncate to 60 chars
    if collapsed.len() > 60 {
        collapsed.truncate(60);
        while collapsed.ends_with('_') { collapsed.pop(); }
    }
    if collapsed.is_empty() {
        "unnamed".to_string()
    } else {
        collapsed
    }
}

/// Resolve the slug for an entity by looking up its name in the DB.
pub async fn resolve_entity_slug(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
) -> Result<String> {
    let name: Option<(String,)> = match entity_type {
        "movie" => {
            sqlx::query_as("SELECT title FROM movies WHERE id = ?")
                .bind(entity_id).fetch_optional(pool).await?
        }
        "series" => {
            sqlx::query_as("SELECT title FROM series WHERE id = ?")
                .bind(entity_id).fetch_optional(pool).await?
        }
        "season" => {
            let row: Option<(String, i64)> = sqlx::query_as(
                "SELECT sr.title, s.season_number FROM seasons s
                 JOIN series sr ON s.series_id = sr.id WHERE s.id = ?"
            ).bind(entity_id).fetch_optional(pool).await?;
            return Ok(match row {
                Some((title, num)) => format!("{}_s{:02}", slugify(&title), num),
                None => "unknown_season".to_string(),
            });
        }
        "episode" => {
            let row: Option<(String, i64, i64)> = sqlx::query_as(
                "SELECT sr.title, s.season_number, e.episode_number
                 FROM episodes e
                 JOIN seasons s ON e.season_id = s.id
                 JOIN series sr ON s.series_id = sr.id
                 WHERE e.id = ?"
            ).bind(entity_id).fetch_optional(pool).await?;
            return Ok(match row {
                Some((title, sn, en)) => format!("{}_s{:02}e{:02}", slugify(&title), sn, en),
                None => "unknown_episode".to_string(),
            });
        }
        "person" => {
            sqlx::query_as("SELECT name FROM people WHERE id = ?")
                .bind(entity_id).fetch_optional(pool).await?
        }
        "studio" => {
            sqlx::query_as("SELECT name FROM studios WHERE id = ?")
                .bind(entity_id).fetch_optional(pool).await?
        }
        "collection" => {
            sqlx::query_as("SELECT name FROM collections WHERE id = ?")
                .bind(entity_id).fetch_optional(pool).await?
        }
        _ => None,
    };
    Ok(match name {
        Some((n,)) => slugify(&n),
        None => format!("{}_{}", entity_type, entity_id),
    })
}

/// Returns true for image types that only allow one image per entity (upsert).
pub fn is_single_image_type(image_type: &str) -> bool {
    matches!(image_type, "poster" | "logo" | "thumbnail")
}

/// Get the next position for a multi-image type.
pub async fn next_position(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    image_type: &str,
) -> Result<i64> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(position), -1) + 1 FROM images
         WHERE entity_type = ? AND entity_id = ? AND image_type = ?"
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(image_type)
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}

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
    Logo,
    Banner,
}

impl ImageType {
    pub fn dir_name(&self) -> &str {
        match self {
            ImageType::Poster => "posters",
            ImageType::Backdrop => "backdrops",
            ImageType::Still => "stills",
            ImageType::Photo => "photos",
            ImageType::Logo => "logos",
            ImageType::Banner => "banners",
        }
    }

    pub fn db_name(&self) -> &str {
        match self {
            ImageType::Poster => "poster",
            ImageType::Backdrop => "backdrop",
            ImageType::Still => "still",
            ImageType::Photo => "photo",
            ImageType::Logo => "logo",
            ImageType::Banner => "banner",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "poster" => Some(ImageType::Poster),
            "backdrop" => Some(ImageType::Backdrop),
            "still" => Some(ImageType::Still),
            "photo" => Some(ImageType::Photo),
            "logo" => Some(ImageType::Logo),
            "banner" => Some(ImageType::Banner),
            _ => None,
        }
    }
}

// ============================================================================
// Cache manager
// ============================================================================

#[derive(Clone)]
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
        for img_type in &[
            ImageType::Poster, ImageType::Backdrop,
            ImageType::Still, ImageType::Photo, ImageType::Logo,
            ImageType::Banner,
        ] {
            for size in ImageSize::all() {
                let dir = self.cache_root
                    .join(img_type.dir_name())
                    .join(size.dir_name());
                std::fs::create_dir_all(&dir)
                    .with_context(|| format!("Failed to create cache dir: {:?}", dir))?;
            }
        }
        // User-uploaded images directory
        std::fs::create_dir_all(self.cache_root.join("user"))
            .with_context(|| "Failed to create user image dir")?;
        Ok(())
    }

    /// Copy a local image file into the cache and return relative paths.
    /// Named using entity slug: `user/{slug}_{id}_{pos:03}.{ext}`
    /// All three size fields point to the same file (no resizing).
    pub fn copy_local_image(
        &self,
        source_path: &Path,
        slug: &str,
        entity_id: i64,
        position: i64,
    ) -> Result<CachedImage> {
        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg");

        let dest_name = format!("{}_{}_{:03}.{}", slug, entity_id, position, ext);
        let dest_path = self.cache_root.join("user").join(&dest_name);

        std::fs::copy(source_path, &dest_path)
            .with_context(|| format!("Failed to copy image to {:?}", dest_path))?;

        let rel = format!("user/{}", dest_name);
        Ok(CachedImage {
            tmdb_path: String::new(),
            thumbnail: Some(rel.clone()),
            medium: Some(rel.clone()),
            large: Some(rel),
        })
    }

    /// Download a TMDB image in all 3 sizes and return local paths.
    /// Files are named `{slug}_{entity_id}_{position:03}.jpg` in each size directory.
    pub async fn download_image(
        &self,
        tmdb_path: &str,
        image_type: ImageType,
        slug: &str,
        entity_id: i64,
        position: i64,
    ) -> Result<CachedImage> {
        // Derive extension from TMDB path (usually .jpg)
        let ext = Path::new(tmdb_path)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("jpg");

        let filename = format!("{}_{}_{:03}.{}", slug, entity_id, position, ext);

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

/// Save an image record — single types (poster/logo/thumbnail) use upsert,
/// multi types (backdrop/photo/still/banner) always insert a new row.
pub async fn save_image_record(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    image_type: &str,
    cached: &CachedImage,
    position: i64,
    slug: &str,
) -> Result<()> {
    if is_single_image_type(image_type) {
        sqlx::query(
            "INSERT INTO images (entity_type, entity_id, image_type, source_url,
             path_thumb, path_medium, path_large, position, entity_slug)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
             ON CONFLICT(entity_type, entity_id, image_type) DO UPDATE SET
             source_url = excluded.source_url,
             path_thumb = excluded.path_thumb,
             path_medium = excluded.path_medium,
             path_large = excluded.path_large,
             entity_slug = excluded.entity_slug,
             updated_at = datetime('now')"
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(image_type)
        .bind(&cached.tmdb_path)
        .bind(&cached.thumbnail)
        .bind(&cached.medium)
        .bind(&cached.large)
        .bind(slug)
        .execute(pool)
        .await?;
    } else {
        sqlx::query(
            "INSERT INTO images (entity_type, entity_id, image_type, source_url,
             path_thumb, path_medium, path_large, position, entity_slug)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(entity_type)
        .bind(entity_id)
        .bind(image_type)
        .bind(&cached.tmdb_path)
        .bind(&cached.thumbnail)
        .bind(&cached.medium)
        .bind(&cached.large)
        .bind(position)
        .bind(slug)
        .execute(pool)
        .await?;
    }
    Ok(())
}

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
    let slug = resolve_entity_slug(pool, "movie", movie_id).await?;

    if let Some(ref p) = poster_path {
        let cached = cache.download_image(p, ImageType::Poster, &slug, movie_id, 0).await?;
        save_image_record(pool, "movie", movie_id, "poster", &cached, 0, &slug).await?;
    }

    if let Some(ref b) = backdrop_path {
        let pos = next_position(pool, "movie", movie_id, "backdrop").await?;
        let cached = cache.download_image(b, ImageType::Backdrop, &slug, movie_id, pos).await?;
        save_image_record(pool, "movie", movie_id, "backdrop", &cached, pos, &slug).await?;
    }

    Ok(())
}

/// Cache all images for a series (poster + backdrop + season posters)
pub async fn cache_series_images(
    pool: &SqlitePool,
    cache: &ImageCache,
    series_id: i64,
) -> Result<()> {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT poster_path, backdrop_path FROM series WHERE id = ?"
    )
    .bind(series_id)
    .fetch_optional(pool)
    .await?;

    let slug = resolve_entity_slug(pool, "series", series_id).await?;

    if let Some((poster_path, backdrop_path)) = row {
        if let Some(ref p) = poster_path {
            let cached = cache.download_image(p, ImageType::Poster, &slug, series_id, 0).await?;
            save_image_record(pool, "series", series_id, "poster", &cached, 0, &slug).await?;
        }
        if let Some(ref b) = backdrop_path {
            let pos = next_position(pool, "series", series_id, "backdrop").await?;
            let cached = cache.download_image(b, ImageType::Backdrop, &slug, series_id, pos).await?;
            save_image_record(pool, "series", series_id, "backdrop", &cached, pos, &slug).await?;
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
            let season_slug = resolve_entity_slug(pool, "season", season_id).await?;
            let cached = cache.download_image(p, ImageType::Poster, &season_slug, season_id, 0).await?;
            save_image_record(pool, "season", season_id, "poster", &cached, 0, &season_slug).await?;
        }
    }

    Ok(())
}

/// Cache the photo for a person
pub async fn cache_person_images(
    pool: &SqlitePool,
    cache: &ImageCache,
    person_id: i64,
) -> Result<()> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT photo_path FROM people WHERE id = ?"
    )
    .bind(person_id)
    .fetch_optional(pool)
    .await?;

    if let Some((Some(photo_path),)) = row {
        let slug = resolve_entity_slug(pool, "person", person_id).await?;
        let pos = next_position(pool, "person", person_id, "photo").await?;
        let cached = cache.download_image(&photo_path, ImageType::Photo, &slug, person_id, pos).await?;
        save_image_record(pool, "person", person_id, "photo", &cached, pos, &slug).await?;
    }
    Ok(())
}

/// Cache the logo for a studio
pub async fn cache_studio_images(
    pool: &SqlitePool,
    cache: &ImageCache,
    studio_id: i64,
) -> Result<()> {
    let row: Option<(Option<String>,)> = sqlx::query_as(
        "SELECT logo_path FROM studios WHERE id = ?"
    )
    .bind(studio_id)
    .fetch_optional(pool)
    .await?;

    if let Some((Some(logo_path),)) = row {
        let slug = resolve_entity_slug(pool, "studio", studio_id).await?;
        let cached = cache.download_image(&logo_path, ImageType::Logo, &slug, studio_id, 0).await?;
        save_image_record(pool, "studio", studio_id, "logo", &cached, 0, &slug).await?;
    }
    Ok(())
}

/// Get all cached images for an entity, ordered by type then position
pub async fn get_entity_images(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
) -> Result<Vec<ImageRecord>> {
    let rows = sqlx::query_as::<_, ImageRecord>(
        "SELECT * FROM images WHERE entity_type = ? AND entity_id = ?
         ORDER BY image_type, position"
    )
    .bind(entity_type)
    .bind(entity_id)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Get cached images for an entity filtered by type, ordered by position
pub async fn get_entity_images_by_type(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    image_type: &str,
) -> Result<Vec<ImageRecord>> {
    let rows = sqlx::query_as::<_, ImageRecord>(
        "SELECT * FROM images WHERE entity_type = ? AND entity_id = ? AND image_type = ?
         ORDER BY position"
    )
    .bind(entity_type)
    .bind(entity_id)
    .bind(image_type)
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

/// Delete a single image by its ID and remove files from disk
pub async fn delete_image_by_id(
    pool: &SqlitePool,
    cache: &ImageCache,
    image_id: i64,
) -> Result<()> {
    let row: Option<(Option<String>, Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT path_thumb, path_medium, path_large FROM images WHERE id = ?"
    )
    .bind(image_id)
    .fetch_optional(pool)
    .await?;

    sqlx::query("DELETE FROM images WHERE id = ?")
        .bind(image_id)
        .execute(pool)
        .await?;

    // Delete files from disk
    if let Some((t, m, l)) = row {
        let root = cache.root();
        for rel in [t, m, l].into_iter().flatten() {
            let _ = std::fs::remove_file(root.join(&rel));
        }
    }
    Ok(())
}

/// Reorder images: accepts a list of image IDs in desired order,
/// updates their position values (0, 1, 2, ...).
pub async fn reorder_images(pool: &SqlitePool, image_ids: &[i64]) -> Result<()> {
    for (pos, id) in image_ids.iter().enumerate() {
        sqlx::query("UPDATE images SET position = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(pos as i64)
            .bind(*id)
            .execute(pool)
            .await?;
    }
    Ok(())
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
    pub position: i64,
    pub entity_slug: String,
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
