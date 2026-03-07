use crate::modules::tmdb::{TmdbClient, TmdbMovieSearchResult, TmdbSeriesSearchResult};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn search_movie_tmdb(
    state: State<'_, AppState>,
    query: String,
    year: Option<i64>,
) -> Result<Vec<TmdbMovieSearchResult>, String> {
    let client = state
        .get_tmdb()
        .ok_or_else(|| "TMDB API key not configured. Set it in Settings > API Keys.".to_string())?;

    client
        .search_movies(&query, year)
        .await
        .map_err(|e| format!("TMDB search failed: {}", e))
}

#[tauri::command]
pub async fn search_series_tmdb(
    state: State<'_, AppState>,
    query: String,
    year: Option<i64>,
) -> Result<Vec<TmdbSeriesSearchResult>, String> {
    let client = state
        .get_tmdb()
        .ok_or_else(|| "TMDB API key not configured. Set it in Settings > API Keys.".to_string())?;

    client
        .search_series(&query, year)
        .await
        .map_err(|e| format!("TMDB search failed: {}", e))
}

#[tauri::command]
pub async fn set_tmdb_api_key(
    state: State<'_, AppState>,
    api_key: String,
    language: Option<String>,
) -> Result<(), String> {
    let lang = language.unwrap_or_else(|| "fr-FR".to_string());
    let client = TmdbClient::new(&api_key, &lang);

    // Validate by making a test request
    client
        .search_movies("test", None)
        .await
        .map_err(|e| format!("Invalid API key: {}", e))?;

    // Store in state
    let mut guard = state
        .tmdb
        .write()
        .map_err(|e| format!("Lock error: {}", e))?;
    *guard = Some(client);

    log::info!("TMDB API key updated successfully");
    Ok(())
}
