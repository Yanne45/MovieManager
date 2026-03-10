use crate::db::{models::*, queries};
use crate::AppState;
use tauri::State;

/// Detect the volume label of the disk/partition containing `path`.
/// On Windows: parses `vol <drive>:` output.
/// On Unix: tries `lsblk -no LABEL <device>` via the mount point.
fn detect_volume_label(path: &str) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let drive = path.chars().next().filter(|c| c.is_ascii_alphabetic())?;
        let output = std::process::Command::new("cmd")
            .args(["/c", &format!("vol {}:", drive)])
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Output: " Volume in drive D is Films"  or  " Volume in drive D has no label."
        for line in stdout.lines() {
            if let Some(pos) = line.find(" is ") {
                let label = line[pos + 4..].trim().to_string();
                if !label.is_empty() {
                    return Some(label);
                }
            }
        }
        None
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = std::process::Command::new("df")
            .arg("--output=source")
            .arg(path)
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let device = stdout.lines().nth(1)?.trim();
        if device.is_empty() {
            return None;
        }
        let label_out = std::process::Command::new("lsblk")
            .args(["-no", "LABEL", device])
            .output()
            .ok()?;
        let label = String::from_utf8_lossy(&label_out.stdout).trim().to_string();
        if label.is_empty() { None } else { Some(label) }
    }
}

#[tauri::command]
pub async fn get_libraries(state: State<'_, AppState>) -> Result<Vec<Library>, String> {
    queries::get_libraries(state.db().pool())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_library(
    state: State<'_, AppState>,
    mut input: CreateLibrary,
) -> Result<Library, String> {
    // Auto-detect volume label if not provided by the caller
    if input.volume_label.is_none() {
        input.volume_label = detect_volume_label(&input.path);
    }
    queries::create_library(state.db().pool(), &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_library(
    state: State<'_, AppState>,
    id: i64,
    input: UpdateLibrary,
) -> Result<Option<Library>, String> {
    queries::update_library(state.db().pool(), id, &input)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_library(
    state: State<'_, AppState>,
    id: i64,
) -> Result<bool, String> {
    queries::delete_library(state.db().pool(), id)
        .await
        .map_err(|e| e.to_string())
}
