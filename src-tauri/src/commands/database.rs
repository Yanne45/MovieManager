use crate::db::Database;
use crate::{AppState, RecentDatabase};
use serde::Serialize;
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct DatabaseInfo {
    pub name: String,
    pub path: String,
}

/// Get info about the currently opened database
#[tauri::command]
pub async fn get_current_database(state: State<'_, AppState>) -> Result<DatabaseInfo, String> {
    let db = state.db.read().map_err(|e| e.to_string())?;
    Ok(DatabaseInfo {
        name: db.name(),
        path: db.path().to_string_lossy().to_string(),
    })
}

/// Get the list of recently opened databases
#[tauri::command]
pub async fn get_recent_databases(state: State<'_, AppState>) -> Result<Vec<RecentDatabase>, String> {
    Ok(crate::load_recent_databases(&state.app_data_dir))
}

/// Create a new empty database at the given path
#[tauri::command]
pub async fn create_database(
    state: State<'_, AppState>,
    path: String,
) -> Result<DatabaseInfo, String> {
    let db_path = PathBuf::from(&path);

    // Clone current DB handle for closing (release lock immediately)
    let current_db = state.db.read().map_err(|e| e.to_string())?.clone();
    current_db.close().await;

    // Create new DB
    let new_db = Database::new(&db_path)
        .await
        .map_err(|e| format!("Failed to create database: {}", e))?;

    let info = DatabaseInfo {
        name: new_db.name(),
        path: new_db.path().to_string_lossy().to_string(),
    };

    // Update recent list
    crate::touch_recent_database(&state.app_data_dir, &info.path, &info.name);

    // Swap in state
    {
        let mut db_lock = state.db.write().map_err(|e| e.to_string())?;
        *db_lock = new_db;
    }

    log::info!("Created and switched to database: {}", path);
    Ok(info)
}

/// Open an existing database file
#[tauri::command]
pub async fn open_database(
    state: State<'_, AppState>,
    path: String,
) -> Result<DatabaseInfo, String> {
    let db_path = PathBuf::from(&path);

    if !db_path.exists() {
        return Err(format!("Database file not found: {}", path));
    }

    // Clone current DB handle for closing (release lock immediately)
    let current_db = state.db.read().map_err(|e| e.to_string())?.clone();
    current_db.close().await;

    // Open existing DB
    let new_db = Database::new(&db_path)
        .await
        .map_err(|e| format!("Failed to open database: {}", e))?;

    let info = DatabaseInfo {
        name: new_db.name(),
        path: new_db.path().to_string_lossy().to_string(),
    };

    // Update recent list
    crate::touch_recent_database(&state.app_data_dir, &info.path, &info.name);

    // Swap in state
    {
        let mut db_lock = state.db.write().map_err(|e| e.to_string())?;
        *db_lock = new_db;
    }

    log::info!("Switched to database: {}", path);
    Ok(info)
}
