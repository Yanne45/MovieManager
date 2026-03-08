use crate::modules::backup::{self, BackupResult};
use crate::AppState;
use tauri::State;

/// Create a full backup (DB + images) as a ZIP file
/// If no output_path is given, uses a dialog to ask for save location
#[tauri::command]
pub async fn create_backup(
    state: State<'_, AppState>,
    output_path: String,
) -> Result<BackupResult, String> {
    let db_path = state.db().path().to_path_buf();
    let image_cache_root = {
        let cache = state.image_cache.read().map_err(|e| e.to_string())?;
        cache.root().to_path_buf()
    };

    // Run in blocking thread (ZIP creation is CPU + IO bound)
    tokio::task::spawn_blocking(move || {
        let out = std::path::Path::new(&output_path);
        backup::create_backup(&db_path, &image_cache_root, out)
    })
    .await
    .map_err(|e| format!("Backup task failed: {}", e))?
    .map_err(|e| format!("Backup error: {}", e))
}

/// Get default backup filename (for save dialog)
#[tauri::command]
pub async fn get_backup_filename() -> Result<String, String> {
    Ok(backup::default_backup_filename())
}
