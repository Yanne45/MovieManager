//! Metadata pipeline module
//!
//! Orchestrates the full flow from parsed filename to enriched DB record:
//! - Takes a ScannedFile from ingestion
//! - Searches TMDB for matching movie/series
//! - Creates or updates DB records
//! - Downloads/caches images
//! - Sends low-confidence matches to inbox

use anyhow::Result;
use sqlx::SqlitePool;

use crate::db::{models, queries};
use crate::modules::change_log::{self, ChangeSource};
use crate::modules::filename_parser::{MediaType, ParsedFilename};
use crate::modules::image_cache::ImageCache;
use crate::modules::ingestion::ScannedFile;
use crate::modules::tmdb::{self, MatchResult, TmdbClient};

/// Confidence threshold — below this, send to inbox instead of auto-matching
const CONFIDENCE_THRESHOLD: u8 = 70;

/// Result of processing a single scanned file
#[derive(Debug, serde::Serialize)]
pub struct ProcessingResult {
    pub file_path: String,
    pub action: ProcessingAction,
    pub entity_type: Option<String>,
    pub entity_id: Option<i64>,
    pub tmdb_id: Option<i64>,
    pub confidence: Option<u8>,
}

#[derive(Debug, serde::Serialize)]
pub enum ProcessingAction {
    /// Movie created/updated with TMDB data
    MovieMatched,
    /// Episode linked to existing series
    EpisodeLinked,
    /// Series created as placeholder (needs manual matching)
    SeriesPlaceholder,
    /// Sent to inbox for manual resolution
    SentToInbox,
    /// File already known, skipped
    Skipped,
    /// Error during processing
    Error(String),
}

/// Process a batch of scanned files (called after scan_directory)
pub async fn process_scanned_files(
    pool: &SqlitePool,
    library_id: i64,
    files: &[ScannedFile],
    tmdb_client: &TmdbClient,
    image_cache: Option<&ImageCache>,
) -> Result<Vec<ProcessingResult>> {
    let mut results = Vec::new();

    for file in files {
        if !file.is_new {
            results.push(ProcessingResult {
                file_path: file.file_path.clone(),
                action: ProcessingAction::Skipped,
                entity_type: None,
                entity_id: None,
                tmdb_id: None,
                confidence: None,
            });
            continue;
        }

        let result = match file.parsed.media_type {
            MediaType::Movie => {
                process_movie(pool, library_id, file, tmdb_client, image_cache).await
            }
            MediaType::Episode => {
                process_episode(pool, library_id, file, tmdb_client, image_cache).await
            }
            MediaType::Unknown => {
                // Send unknown files to inbox
                send_to_inbox(pool, file, "unrecognized", None).await
            }
        };

        match result {
            Ok(r) => results.push(r),
            Err(e) => {
                log::error!("Error processing {}: {}", file.file_path, e);
                results.push(ProcessingResult {
                    file_path: file.file_path.clone(),
                    action: ProcessingAction::Error(e.to_string()),
                    entity_type: None,
                    entity_id: None,
                    tmdb_id: None,
                    confidence: None,
                });
            }
        }
    }

    Ok(results)
}

/// Process a movie file
async fn process_movie(
    pool: &SqlitePool,
    library_id: i64,
    file: &ScannedFile,
    tmdb_client: &TmdbClient,
    image_cache: Option<&ImageCache>,
) -> Result<ProcessingResult> {
    let parsed = &file.parsed;
    let title = parsed.title.as_deref().unwrap_or("Unknown");

    // Search TMDB
    let search_results = tmdb_client
        .search_movies(title, parsed.year)
        .await?;

    // Match
    let match_result = tmdb::match_movie(title, parsed.year, &search_results);

    match match_result {
        Some(m) if m.confidence >= CONFIDENCE_THRESHOLD => {
            // High confidence — auto-match
            let movie = create_or_update_movie(pool, &m, tmdb_client).await?;
            let version = create_media_version_and_file(
                pool, "movie", movie.id, library_id, file,
            ).await?;

            // Cache images (best effort)
            if let Some(cache) = image_cache {
                if let Err(e) = crate::modules::image_cache::cache_movie_images(pool, cache, movie.id).await {
                    log::warn!("Image cache failed for movie {}: {}", movie.id, e);
                }
            }

            Ok(ProcessingResult {
                file_path: file.file_path.clone(),
                action: ProcessingAction::MovieMatched,
                entity_type: Some("movie".into()),
                entity_id: Some(movie.id),
                tmdb_id: Some(m.tmdb_id),
                confidence: Some(m.confidence),
            })
        }
        Some(m) => {
            // Low confidence — send to inbox with candidates
            let candidates = search_results
                .iter()
                .take(5)
                .map(|r| serde_json::json!({
                    "title": r.title,
                    "year": r.release_date,
                    "tmdbId": r.id,
                    "confidence": tmdb::match_movie(title, parsed.year, &[r.clone()])
                        .map(|m| m.confidence)
                        .unwrap_or(0),
                }))
                .collect::<Vec<_>>();

            send_to_inbox_with_candidates(
                pool, file, "low_confidence", &candidates,
            ).await
        }
        None => {
            // No match at all
            send_to_inbox(pool, file, "unrecognized", None).await
        }
    }
}

/// Process an episode file
async fn process_episode(
    pool: &SqlitePool,
    library_id: i64,
    file: &ScannedFile,
    tmdb_client: &TmdbClient,
    image_cache: Option<&ImageCache>,
) -> Result<ProcessingResult> {
    let parsed = &file.parsed;
    let title = parsed.title.as_deref().unwrap_or("Unknown");
    let season_num = parsed.season.unwrap_or(1) as i64;
    let episode_nums = &parsed.episodes;

    if episode_nums.is_empty() {
        return send_to_inbox(pool, file, "unrecognized", None).await;
    }

    // Search for the series on TMDB
    let search_results = tmdb_client.search_series(title, parsed.year).await?;
    let match_result = tmdb::match_series(title, parsed.year, &search_results);

    match match_result {
        Some(m) if m.confidence >= CONFIDENCE_THRESHOLD => {
            // Find or create series in DB
            let series = find_or_create_series(pool, &m, tmdb_client).await?;

            // Ensure season exists
            let season = ensure_season(pool, &series, season_num, tmdb_client, m.tmdb_id).await?;

            // Link each episode
            for &ep_num in episode_nums {
                let ep_num = ep_num as i64;
                let episode = ensure_episode(pool, &series, &season, ep_num, tmdb_client, m.tmdb_id, season_num).await?;

                // Create media version + file
                let _version = create_media_version_and_file(
                    pool, "episode", episode.id, library_id, file,
                ).await?;

                // Mark episode as having a file
                sqlx::query("UPDATE episodes SET has_file = 1, updated_at = datetime('now') WHERE id = ?")
                    .bind(episode.id)
                    .execute(pool)
                    .await?;
            }

            // Cache series images (best effort)
            if let Some(cache) = image_cache {
                if let Err(e) = crate::modules::image_cache::cache_series_images(pool, cache, series.id).await {
                    log::warn!("Image cache failed for series {}: {}", series.id, e);
                }
            }

            Ok(ProcessingResult {
                file_path: file.file_path.clone(),
                action: ProcessingAction::EpisodeLinked,
                entity_type: Some("series".into()),
                entity_id: Some(series.id),
                tmdb_id: Some(m.tmdb_id),
                confidence: Some(m.confidence),
            })
        }
        Some(m) => {
            // Low confidence — inbox
            let candidates = search_results
                .iter()
                .take(5)
                .map(|r| serde_json::json!({
                    "title": r.name,
                    "year": r.first_air_date,
                    "tmdbId": r.id,
                    "confidence": tmdb::match_series(title, parsed.year, &[r.clone()])
                        .map(|m| m.confidence)
                        .unwrap_or(0),
                }))
                .collect::<Vec<_>>();

            send_to_inbox_with_candidates(pool, file, "low_confidence", &candidates).await
        }
        None => {
            // No match — create placeholder series
            create_placeholder_series(pool, file, title).await
        }
    }
}

// ============================================================================
// DB helpers
// ============================================================================

/// Create or update a movie from TMDB match
async fn create_or_update_movie(
    pool: &SqlitePool,
    match_result: &MatchResult,
    tmdb_client: &TmdbClient,
) -> Result<models::Movie> {
    // Check if movie already exists by TMDB ID
    if let Some(existing) = queries::find_movie_by_tmdb(pool, match_result.tmdb_id).await? {
        return Ok(existing);
    }

    // Fetch full details from TMDB
    let detail = tmdb_client.get_movie(match_result.tmdb_id).await?;

    let movie = queries::create_movie(pool, &models::CreateMovie {
        title: detail.title,
        original_title: detail.original_title,
        year: detail.release_date.as_deref()
            .and_then(|d| d.get(..4))
            .and_then(|y| y.parse().ok()),
        runtime: detail.runtime,
        overview: detail.overview,
        owned: Some(true),
        tmdb_id: Some(detail.id),
        imdb_id: detail.imdb_id,
        notes: None,
    }).await?;

    // Update poster/backdrop paths
    if detail.poster_path.is_some() || detail.backdrop_path.is_some() {
        sqlx::query(
            "UPDATE movies SET poster_path = ?, backdrop_path = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(&detail.poster_path)
        .bind(&detail.backdrop_path)
        .bind(movie.id)
        .execute(pool)
        .await?;
    }

    // Insert genres
    if let Some(genres) = &detail.genres {
        for g in genres {
            let genre = sqlx::query_as::<_, (i64,)>(
                "INSERT INTO genres (name, tmdb_id) VALUES (?, ?)
                 ON CONFLICT(name) DO UPDATE SET name = name
                 RETURNING id"
            )
            .bind(&g.name)
            .bind(g.id)
            .fetch_one(pool)
            .await?;

            sqlx::query("INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)")
                .bind(movie.id)
                .bind(genre.0)
                .execute(pool)
                .await?;
        }
    }

    // Insert cast (top 10)
    if let Some(credits) = &detail.credits {
        if let Some(cast) = &credits.cast {
            for member in cast.iter().take(10) {
                let person_id = ensure_person(pool, member.id, &member.name, "Acteur", member.profile_path.as_deref()).await?;
                sqlx::query(
                    "INSERT OR IGNORE INTO movie_people (movie_id, person_id, role, character_name, credit_order)
                     VALUES (?, ?, 'actor', ?, ?)"
                )
                .bind(movie.id)
                .bind(person_id)
                .bind(&member.character)
                .bind(member.order)
                .execute(pool)
                .await?;
            }
        }
        // Insert director
        if let Some(crew) = &credits.crew {
            for member in crew.iter().filter(|c| c.job.as_deref() == Some("Director")) {
                let person_id = ensure_person(pool, member.id, &member.name, "Réalisateur", member.profile_path.as_deref()).await?;
                sqlx::query(
                    "INSERT OR IGNORE INTO movie_people (movie_id, person_id, role)
                     VALUES (?, ?, 'director')"
                )
                .bind(movie.id)
                .bind(person_id)
                .execute(pool)
                .await?;
            }
        }
    }

    // Insert studios
    if let Some(companies) = &detail.production_companies {
        for company in companies {
            let studio_id = ensure_studio(pool, company.id, &company.name, company.origin_country.as_deref()).await?;
            sqlx::query("INSERT OR IGNORE INTO movie_studios (movie_id, studio_id) VALUES (?, ?)")
                .bind(movie.id)
                .bind(studio_id)
                .execute(pool)
                .await?;
        }
    }

    log::info!("Created movie '{}' (TMDB #{})", movie.title, match_result.tmdb_id);

    // Record creation in change_log
    change_log::record_change(
        pool, "movie", movie.id, "title",
        None, Some(&movie.title), ChangeSource::Tmdb,
    ).await.ok();

    Ok(movie)
}

/// Find existing series by TMDB ID or create from TMDB data
async fn find_or_create_series(
    pool: &SqlitePool,
    match_result: &MatchResult,
    tmdb_client: &TmdbClient,
) -> Result<models::Series> {
    // Check existing
    let existing: Option<models::Series> = sqlx::query_as(
        "SELECT * FROM series WHERE tmdb_id = ?"
    )
    .bind(match_result.tmdb_id)
    .fetch_optional(pool)
    .await?;

    if let Some(s) = existing {
        return Ok(s);
    }

    // Fetch full details
    let detail = tmdb_client.get_series(match_result.tmdb_id).await?;
    let status = detail.status.as_deref().map(tmdb::map_series_status).unwrap_or("ongoing");

    let series: models::Series = sqlx::query_as(
        "INSERT INTO series (title, original_title, overview, first_air_date, last_air_date,
         status, total_seasons, total_episodes, poster_path, backdrop_path, tmdb_id, owned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         RETURNING *"
    )
    .bind(&detail.name)
    .bind(&detail.original_name)
    .bind(&detail.overview)
    .bind(&detail.first_air_date)
    .bind(&detail.last_air_date)
    .bind(status)
    .bind(detail.number_of_seasons)
    .bind(detail.number_of_episodes)
    .bind(&detail.poster_path)
    .bind(&detail.backdrop_path)
    .bind(detail.id)
    .fetch_one(pool)
    .await?;

    log::info!("Created series '{}' (TMDB #{})", series.title, match_result.tmdb_id);

    // Record creation in change_log
    change_log::record_change(
        pool, "series", series.id, "title",
        None, Some(&series.title), ChangeSource::Tmdb,
    ).await.ok();

    Ok(series)
}

/// Ensure a season record exists, fetching from TMDB if needed
async fn ensure_season(
    pool: &SqlitePool,
    series: &models::Series,
    season_number: i64,
    tmdb_client: &TmdbClient,
    series_tmdb_id: i64,
) -> Result<models::Season> {
    let existing: Option<models::Season> = sqlx::query_as(
        "SELECT * FROM seasons WHERE series_id = ? AND season_number = ?"
    )
    .bind(series.id)
    .bind(season_number)
    .fetch_optional(pool)
    .await?;

    if let Some(s) = existing {
        return Ok(s);
    }

    // Fetch from TMDB
    let tmdb_season = tmdb_client.get_season(series_tmdb_id, season_number).await?;

    let season: models::Season = sqlx::query_as(
        "INSERT INTO seasons (series_id, season_number, title, overview, air_date, episode_count, poster_path, tmdb_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *"
    )
    .bind(series.id)
    .bind(season_number)
    .bind(&tmdb_season.name)
    .bind(&tmdb_season.overview)
    .bind(&tmdb_season.air_date)
    .bind(tmdb_season.episodes.as_ref().map(|e| e.len() as i64))
    .bind(&tmdb_season.poster_path)
    .bind(tmdb_season.id)
    .fetch_one(pool)
    .await?;

    // Pre-populate all episodes from TMDB (with has_file = false)
    if let Some(episodes) = &tmdb_season.episodes {
        for ep in episodes {
            let _: Option<(i64,)> = sqlx::query_as(
                "INSERT OR IGNORE INTO episodes
                 (series_id, season_id, episode_number, title, overview, air_date, runtime, has_file, tmdb_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
                 RETURNING id"
            )
            .bind(series.id)
            .bind(season.id)
            .bind(ep.episode_number)
            .bind(&ep.name)
            .bind(&ep.overview)
            .bind(&ep.air_date)
            .bind(ep.runtime)
            .bind(ep.id)
            .fetch_optional(pool)
            .await?;
        }
    }

    Ok(season)
}

/// Ensure an episode record exists
async fn ensure_episode(
    pool: &SqlitePool,
    series: &models::Series,
    season: &models::Season,
    episode_number: i64,
    _tmdb_client: &TmdbClient,
    _series_tmdb_id: i64,
    _season_number: i64,
) -> Result<models::Episode> {
    let existing: Option<models::Episode> = sqlx::query_as(
        "SELECT * FROM episodes WHERE season_id = ? AND episode_number = ?"
    )
    .bind(season.id)
    .bind(episode_number)
    .fetch_optional(pool)
    .await?;

    if let Some(e) = existing {
        return Ok(e);
    }

    // Episode not pre-populated — create minimal record
    let episode: models::Episode = sqlx::query_as(
        "INSERT INTO episodes (series_id, season_id, episode_number, has_file)
         VALUES (?, ?, ?, 0)
         RETURNING *"
    )
    .bind(series.id)
    .bind(season.id)
    .bind(episode_number)
    .fetch_one(pool)
    .await?;

    Ok(episode)
}

/// Ensure a person exists in DB
async fn ensure_person(
    pool: &SqlitePool,
    tmdb_id: i64,
    name: &str,
    role: &str,
    photo_path: Option<&str>,
) -> Result<i64> {
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM people WHERE tmdb_id = ?"
    )
    .bind(tmdb_id)
    .fetch_optional(pool)
    .await?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let row: (i64,) = sqlx::query_as(
        "INSERT INTO people (name, primary_role, photo_path, tmdb_id) VALUES (?, ?, ?, ?) RETURNING id"
    )
    .bind(name)
    .bind(role)
    .bind(photo_path)
    .bind(tmdb_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

/// Ensure a studio exists in DB
async fn ensure_studio(
    pool: &SqlitePool,
    tmdb_id: i64,
    name: &str,
    country: Option<&str>,
) -> Result<i64> {
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM studios WHERE tmdb_id = ?"
    )
    .bind(tmdb_id)
    .fetch_optional(pool)
    .await?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let row: (i64,) = sqlx::query_as(
        "INSERT INTO studios (name, country, tmdb_id) VALUES (?, ?, ?) RETURNING id"
    )
    .bind(name)
    .bind(country)
    .bind(tmdb_id)
    .fetch_one(pool)
    .await?;

    Ok(row.0)
}

/// Create media version + file for any entity, then run FFprobe analysis
async fn create_media_version_and_file(
    pool: &SqlitePool,
    owner_type: &str,
    owner_id: i64,
    library_id: i64,
    file: &ScannedFile,
) -> Result<models::MediaVersion> {
    let label = file.parsed.quality.as_deref().unwrap_or("Unknown");

    let version = queries::create_media_version(pool, owner_type, owner_id, Some(label)).await?;
    queries::create_media_file(
        pool,
        version.id,
        library_id,
        &file.file_path,
        &file.file_name,
        Some(file.file_size as i64),
    ).await?;

    // Run FFprobe analysis (best effort — don't fail the whole pipeline)
    match crate::modules::media_analysis::analyze_and_update(pool, version.id, &file.file_path).await {
        Ok(analysis) => {
            log::info!(
                "FFprobe: {} → {} {} score={}",
                file.file_name,
                analysis.video.as_ref().map(|v| v.resolution_label.as_str()).unwrap_or("?"),
                analysis.video.as_ref().map(|v| v.codec.as_str()).unwrap_or("?"),
                analysis.quality_score
            );
        }
        Err(e) => {
            log::warn!("FFprobe failed for {} (non-blocking): {}", file.file_name, e);
        }
    }

    // Re-fetch version with updated fields
    let updated: models::MediaVersion = sqlx::query_as(
        "SELECT * FROM media_versions WHERE id = ?"
    )
    .bind(version.id)
    .fetch_one(pool)
    .await?;

    Ok(updated)
}

// ============================================================================
// Inbox helpers
// ============================================================================

async fn send_to_inbox(
    pool: &SqlitePool,
    file: &ScannedFile,
    category: &str,
    entity_info: Option<(&str, i64)>,
) -> Result<ProcessingResult> {
    send_to_inbox_with_candidates(pool, file, category, &[]).await
}

async fn send_to_inbox_with_candidates(
    pool: &SqlitePool,
    file: &ScannedFile,
    category: &str,
    candidates: &[serde_json::Value],
) -> Result<ProcessingResult> {
    let candidates_json = if candidates.is_empty() {
        None
    } else {
        Some(serde_json::to_string(candidates)?)
    };

    sqlx::query(
        "INSERT INTO inbox_items (category, status, file_path, parsed_title, parsed_year,
         parsed_season, parsed_episode, match_candidates)
         VALUES (?, 'pending', ?, ?, ?, ?, ?, ?)"
    )
    .bind(category)
    .bind(&file.file_path)
    .bind(&file.parsed.title)
    .bind(file.parsed.year.map(|y| y as i64))
    .bind(file.parsed.season.map(|s| s as i64))
    .bind(file.parsed.episodes.first().map(|e| e.to_string()))
    .bind(&candidates_json)
    .execute(pool)
    .await?;

    Ok(ProcessingResult {
        file_path: file.file_path.clone(),
        action: ProcessingAction::SentToInbox,
        entity_type: None,
        entity_id: None,
        tmdb_id: None,
        confidence: None,
    })
}

async fn create_placeholder_series(
    pool: &SqlitePool,
    file: &ScannedFile,
    title: &str,
) -> Result<ProcessingResult> {
    // Check if placeholder already exists
    let existing: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM series WHERE title = ? AND is_placeholder = 1"
    )
    .bind(title)
    .fetch_optional(pool)
    .await?;

    let series_id = if let Some((id,)) = existing {
        id
    } else {
        let row: (i64,) = sqlx::query_as(
            "INSERT INTO series (title, status, is_placeholder, owned) VALUES (?, 'ongoing', 1, 1) RETURNING id"
        )
        .bind(title)
        .fetch_one(pool)
        .await?;
        row.0
    };

    // Also send to inbox
    sqlx::query(
        "INSERT INTO inbox_items (category, status, file_path, parsed_title, parsed_season,
         parsed_episode, entity_type, entity_id)
         VALUES ('placeholder', 'pending', ?, ?, ?, ?, 'series', ?)"
    )
    .bind(&file.file_path)
    .bind(title)
    .bind(file.parsed.season.map(|s| s as i64))
    .bind(file.parsed.episodes.first().map(|e| e.to_string()))
    .bind(series_id)
    .execute(pool)
    .await?;

    Ok(ProcessingResult {
        file_path: file.file_path.clone(),
        action: ProcessingAction::SeriesPlaceholder,
        entity_type: Some("series".into()),
        entity_id: Some(series_id),
        tmdb_id: None,
        confidence: None,
    })
}

// ============================================================================
// Public wrappers (for inbox resolution)
// ============================================================================

/// Public wrapper for create_or_update_movie
pub async fn create_or_update_movie_pub(
    pool: &SqlitePool,
    match_result: &MatchResult,
    tmdb_client: &TmdbClient,
) -> Result<models::Movie> {
    create_or_update_movie(pool, match_result, tmdb_client).await
}

/// Public wrapper for find_or_create_series
pub async fn find_or_create_series_pub(
    pool: &SqlitePool,
    match_result: &MatchResult,
    tmdb_client: &TmdbClient,
) -> Result<models::Series> {
    find_or_create_series(pool, match_result, tmdb_client).await
}
