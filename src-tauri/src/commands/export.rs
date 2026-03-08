use crate::db::{models::*, queries};
use crate::AppState;
use serde::Serialize;
use std::io::Write;
use tauri::State;

/// Export result
#[derive(Debug, Serialize)]
pub struct ExportResult {
    pub output_path: String,
    pub movies_count: usize,
    pub series_count: usize,
    pub format: String,
}

/// Export catalogue as JSON
#[tauri::command]
pub async fn export_json(
    state: State<'_, AppState>,
    output_path: String,
) -> Result<ExportResult, String> {
    let db = state.db();
    let pool = db.pool();

    let movies = queries::export_movies(pool).await.map_err(|e| e.to_string())?;
    let series = queries::export_series(pool).await.map_err(|e| e.to_string())?;

    let export = serde_json::json!({
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "movies_count": movies.len(),
        "series_count": series.len(),
        "movies": movies,
        "series": series,
    });

    let json_str = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    std::fs::write(&output_path, json_str).map_err(|e| e.to_string())?;

    Ok(ExportResult {
        output_path,
        movies_count: movies.len(),
        series_count: series.len(),
        format: "json".into(),
    })
}

/// Export catalogue as CSV (two files: movies.csv + series.csv in a directory)
#[tauri::command]
pub async fn export_csv(
    state: State<'_, AppState>,
    output_dir: String,
) -> Result<ExportResult, String> {
    let db = state.db();
    let pool = db.pool();

    let movies = queries::export_movies(pool).await.map_err(|e| e.to_string())?;
    let series = queries::export_series(pool).await.map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    // Movies CSV
    let movies_path = std::path::Path::new(&output_dir).join("movies.csv");
    write_movies_csv(&movies, &movies_path).map_err(|e| e.to_string())?;

    // Series CSV
    let series_path = std::path::Path::new(&output_dir).join("series.csv");
    write_series_csv(&series, &series_path).map_err(|e| e.to_string())?;

    Ok(ExportResult {
        output_path: output_dir,
        movies_count: movies.len(),
        series_count: series.len(),
        format: "csv".into(),
    })
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn opt(s: &Option<String>) -> String {
    s.as_deref().unwrap_or("").to_string()
}

fn write_movies_csv(movies: &[MovieExportRow], path: &std::path::Path) -> std::io::Result<()> {
    let mut f = std::fs::File::create(path)?;
    // BOM for Excel UTF-8 compatibility
    f.write_all(b"\xEF\xBB\xBF")?;
    writeln!(f, "ID,Titre,Titre original,Année,Durée (min),Synopsis,Classification,Tagline,Possédé,TMDB ID,IMDb ID,Score qualité,Genres,Réalisateurs,Acteurs,Studios,Tags")?;

    for m in movies {
        writeln!(f, "{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}",
            m.id,
            csv_escape(&m.title),
            csv_escape(&opt(&m.original_title)),
            m.year.map(|y| y.to_string()).unwrap_or_default(),
            m.runtime.map(|r| r.to_string()).unwrap_or_default(),
            csv_escape(&opt(&m.overview)),
            csv_escape(&opt(&m.content_rating)),
            csv_escape(&opt(&m.tagline)),
            if m.owned { "Oui" } else { "Non" },
            m.tmdb_id.map(|t| t.to_string()).unwrap_or_default(),
            csv_escape(&opt(&m.imdb_id)),
            csv_escape(&opt(&m.primary_quality_score)),
            csv_escape(&opt(&m.genres)),
            csv_escape(&opt(&m.directors)),
            csv_escape(&opt(&m.actors)),
            csv_escape(&opt(&m.studios)),
            csv_escape(&opt(&m.tags)),
        )?;
    }
    Ok(())
}

fn write_series_csv(series: &[SeriesExportRow], path: &std::path::Path) -> std::io::Result<()> {
    let mut f = std::fs::File::create(path)?;
    f.write_all(b"\xEF\xBB\xBF")?;
    writeln!(f, "ID,Titre,Titre original,Synopsis,Première diffusion,Dernière diffusion,Statut,Saisons,Épisodes total,TMDB ID,Genres,Épisodes possédés,Épisodes en base")?;

    for s in series {
        writeln!(f, "{},{},{},{},{},{},{},{},{},{},{},{},{}",
            s.id,
            csv_escape(&s.title),
            csv_escape(&opt(&s.original_title)),
            csv_escape(&opt(&s.overview)),
            csv_escape(&opt(&s.first_air_date)),
            csv_escape(&opt(&s.last_air_date)),
            csv_escape(&opt(&s.status)),
            s.total_seasons.map(|n| n.to_string()).unwrap_or_default(),
            s.total_episodes.map(|n| n.to_string()).unwrap_or_default(),
            s.tmdb_id.map(|t| t.to_string()).unwrap_or_default(),
            csv_escape(&opt(&s.genres)),
            s.owned_episodes,
            s.total_episode_records,
        )?;
    }
    Ok(())
}
