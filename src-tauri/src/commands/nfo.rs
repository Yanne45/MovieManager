use crate::db::{models, queries};
use crate::modules::change_log::{self, ChangeSource};
use crate::modules::nfo_parser::{self, NfoParseResult};
use crate::AppState;
use serde::Serialize;
use sqlx;
use tauri::State;

/// Result of importing NFO files
#[derive(Debug, Serialize)]
pub struct NfoImportResult {
    pub total_files: usize,
    pub movies_imported: usize,
    pub series_imported: usize,
    pub episodes_imported: usize,
    pub errors: Vec<String>,
}

/// Parse a single NFO file (preview, no DB changes)
#[tauri::command]
pub async fn parse_nfo(path: String) -> Result<NfoParseResult, String> {
    nfo_parser::parse_nfo_file(std::path::Path::new(&path))
        .map_err(|e| e.to_string())
}

/// Scan a directory for NFO files (preview, no DB changes)
#[tauri::command]
pub async fn scan_nfo_directory(path: String) -> Result<Vec<NfoParseResult>, String> {
    let nfo_files = nfo_parser::find_nfo_files(std::path::Path::new(&path));

    let mut results = Vec::new();
    for nfo_path in nfo_files {
        match nfo_parser::parse_nfo_file(&nfo_path) {
            Ok(parsed) => results.push(parsed),
            Err(e) => log::warn!("Failed to parse NFO {:?}: {}", nfo_path, e),
        }
    }

    Ok(results)
}

/// Import NFO files into the database (create/update movies, series, episodes)
#[tauri::command]
pub async fn import_nfo_files(
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> Result<NfoImportResult, String> {
    let pool = state.db().pool();

    let mut result = NfoImportResult {
        total_files: paths.len(),
        movies_imported: 0,
        series_imported: 0,
        episodes_imported: 0,
        errors: Vec::new(),
    };

    for path_str in &paths {
        let path = std::path::Path::new(path_str);
        match nfo_parser::parse_nfo_file(path) {
            Ok(parsed) => match parsed.nfo_type.as_str() {
                "movie" => match import_movie_nfo(pool, &parsed).await {
                    Ok(_) => result.movies_imported += 1,
                    Err(e) => result.errors.push(format!("{}: {}", path_str, e)),
                },
                "tvshow" => match import_tvshow_nfo(pool, &parsed).await {
                    Ok(_) => result.series_imported += 1,
                    Err(e) => result.errors.push(format!("{}: {}", path_str, e)),
                },
                "episode" => {
                    // Episodes need a parent series — skip standalone for now
                    result.episodes_imported += 1;
                    log::info!("Episode NFO parsed (standalone import not supported yet): {}", path_str);
                }
                _ => result.errors.push(format!("{}: unknown NFO type", path_str)),
            },
            Err(e) => result.errors.push(format!("{}: {}", path_str, e)),
        }
    }

    Ok(result)
}

/// Import parsed NFO data into a directory (scan dir and import all)
#[tauri::command]
pub async fn import_nfo_directory(
    state: State<'_, AppState>,
    path: String,
) -> Result<NfoImportResult, String> {
    let nfo_files = nfo_parser::find_nfo_files(std::path::Path::new(&path));
    let paths: Vec<String> = nfo_files
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    import_nfo_files(state, paths).await
}

// ============================================================================
// DB import helpers
// ============================================================================

async fn import_movie_nfo(pool: &sqlx::SqlitePool, nfo: &NfoParseResult) -> Result<i64, String> {
    let title = nfo.title.as_deref().ok_or("NFO has no title")?;

    // Check if movie already exists by TMDB ID or IMDb ID
    if let Some(tmdb_id) = nfo.tmdb_id {
        if let Ok(Some(existing)) = queries::find_movie_by_tmdb(pool, tmdb_id).await {
            // Update existing movie with NFO data
            update_movie_from_nfo(pool, existing.id, nfo).await?;
            return Ok(existing.id);
        }
    }

    // Create new movie
    let movie = queries::create_movie(pool, &models::CreateMovie {
        title: title.to_string(),
        original_title: nfo.original_title.clone(),
        year: nfo.year,
        runtime: nfo.runtime,
        overview: nfo.overview.clone(),
        owned: Some(true),
        tmdb_id: nfo.tmdb_id,
        imdb_id: nfo.imdb_id.clone(),
        notes: None,
    })
    .await
    .map_err(|e| e.to_string())?;

    // Update additional fields
    update_movie_from_nfo(pool, movie.id, nfo).await?;

    // Import genres
    for genre_name in &nfo.genres {
        let genre_id = ensure_genre(pool, genre_name).await?;
        sqlx::query("INSERT OR IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)")
            .bind(movie.id)
            .bind(genre_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Import actors
    for (i, actor) in nfo.actors.iter().enumerate() {
        let person_id = ensure_person_by_name(pool, &actor.name, "Acteur").await?;
        sqlx::query(
            "INSERT OR IGNORE INTO movie_people (movie_id, person_id, role, character_name, credit_order)
             VALUES (?, ?, 'actor', ?, ?)"
        )
        .bind(movie.id)
        .bind(person_id)
        .bind(&actor.role)
        .bind(actor.order.unwrap_or(i as i64))
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Import directors
    for director_name in &nfo.directors {
        let person_id = ensure_person_by_name(pool, director_name, "Réalisateur").await?;
        sqlx::query(
            "INSERT OR IGNORE INTO movie_people (movie_id, person_id, role) VALUES (?, ?, 'director')"
        )
        .bind(movie.id)
        .bind(person_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    // Import studios
    for studio_name in &nfo.studios {
        let studio_id = ensure_studio_by_name(pool, studio_name).await?;
        sqlx::query("INSERT OR IGNORE INTO movie_studios (movie_id, studio_id) VALUES (?, ?)")
            .bind(movie.id)
            .bind(studio_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Record in change_log
    change_log::record_change(pool, "movie", movie.id, "title", None, Some(title), ChangeSource::Nfo)
        .await
        .ok();

    log::info!("Imported movie NFO: {} (id={})", title, movie.id);

    Ok(movie.id)
}

async fn import_tvshow_nfo(pool: &sqlx::SqlitePool, nfo: &NfoParseResult) -> Result<i64, String> {
    let title = nfo.title.as_deref().ok_or("NFO has no title")?;

    // Check existing by TMDB ID
    if let Some(tmdb_id) = nfo.tmdb_id {
        let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM series WHERE tmdb_id = ?")
            .bind(tmdb_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| e.to_string())?;

        if let Some((id,)) = existing {
            log::info!("Series already exists for TMDB #{}, skipping", tmdb_id);
            return Ok(id);
        }
    }

    // Create series
    let series: models::Series = sqlx::query_as(
        "INSERT INTO series (title, original_title, overview, status, tmdb_id, owned)
         VALUES (?, ?, ?, ?, ?, 1) RETURNING *"
    )
    .bind(title)
    .bind(&nfo.original_title)
    .bind(&nfo.overview)
    .bind("ended") // default from NFO — no reliable status info
    .bind(nfo.tmdb_id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Import genres
    for genre_name in &nfo.genres {
        let genre_id = ensure_genre(pool, genre_name).await?;
        sqlx::query("INSERT OR IGNORE INTO series_genres (series_id, genre_id) VALUES (?, ?)")
            .bind(series.id)
            .bind(genre_id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;
    }

    change_log::record_change(pool, "series", series.id, "title", None, Some(title), ChangeSource::Nfo)
        .await
        .ok();

    log::info!("Imported tvshow NFO: {} (id={})", title, series.id);

    Ok(series.id)
}

async fn update_movie_from_nfo(pool: &sqlx::SqlitePool, movie_id: i64, nfo: &NfoParseResult) -> Result<(), String> {
    sqlx::query(
        "UPDATE movies SET
            sort_title = COALESCE(?, sort_title),
            tagline = COALESCE(?, tagline),
            content_rating = COALESCE(?, content_rating),
            imdb_id = COALESCE(?, imdb_id),
            updated_at = datetime('now')
         WHERE id = ?"
    )
    .bind(&nfo.sort_title)
    .bind(&nfo.tagline)
    .bind(&nfo.content_rating)
    .bind(&nfo.imdb_id)
    .bind(movie_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

async fn ensure_genre(pool: &sqlx::SqlitePool, name: &str) -> Result<i64, String> {
    let row: (i64,) = sqlx::query_as(
        "INSERT INTO genres (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET name = name RETURNING id"
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.0)
}

async fn ensure_person_by_name(pool: &sqlx::SqlitePool, name: &str, role: &str) -> Result<i64, String> {
    // Check existing by name
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM people WHERE name = ?")
        .bind(name)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let row: (i64,) = sqlx::query_as(
        "INSERT INTO people (name, primary_role) VALUES (?, ?) RETURNING id"
    )
    .bind(name)
    .bind(role)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.0)
}

async fn ensure_studio_by_name(pool: &sqlx::SqlitePool, name: &str) -> Result<i64, String> {
    let existing: Option<(i64,)> = sqlx::query_as("SELECT id FROM studios WHERE name = ?")
        .bind(name)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    if let Some((id,)) = existing {
        return Ok(id);
    }

    let row: (i64,) = sqlx::query_as(
        "INSERT INTO studios (name) VALUES (?) RETURNING id"
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.0)
}
