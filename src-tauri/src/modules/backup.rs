//! Backup/export module
//!
//! Creates a ZIP archive containing:
//! - The SQLite database file
//! - The image cache directory
//! - A metadata JSON with backup info

use anyhow::Result;
use chrono::Utc;
use serde::Serialize;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

/// Backup metadata included in the archive
#[derive(Debug, Serialize)]
pub struct BackupMetadata {
    pub app_version: String,
    pub backup_date: String,
    pub db_file: String,
    pub image_count: usize,
    pub total_size_bytes: u64,
}

/// Result returned to the frontend
#[derive(Debug, Clone, Serialize)]
pub struct BackupResult {
    pub output_path: String,
    pub db_size_bytes: u64,
    pub image_count: usize,
    pub images_size_bytes: u64,
    pub total_size_bytes: u64,
}

/// Create a full backup ZIP
///
/// # Arguments
/// - `db_path`: Path to the SQLite database file
/// - `image_cache_root`: Path to the image cache root directory
/// - `output_path`: Where to write the ZIP file
pub fn create_backup(
    db_path: &Path,
    image_cache_root: &Path,
    output_path: &Path,
) -> Result<BackupResult> {
    // Ensure parent directory exists
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let file = File::create(output_path)?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(6));

    let mut db_size: u64 = 0;
    let mut image_count: usize = 0;
    let mut images_size: u64 = 0;

    // 1. Add the database file
    if db_path.exists() {
        let db_filename = db_path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("moviemanager.db");

        zip.start_file(format!("database/{}", db_filename), options)?;
        let mut db_file = File::open(db_path)?;
        db_size = io::copy(&mut db_file, &mut zip)?;

        log::info!("Backup: database {} ({} bytes)", db_filename, db_size);
    }

    // 2. Add the WAL and SHM files if they exist (for SQLite consistency)
    for suffix in &["-wal", "-shm"] {
        let wal_path = PathBuf::from(format!("{}{}", db_path.display(), suffix));
        if wal_path.exists() {
            let wal_name = wal_path
                .file_name()
                .and_then(|f| f.to_str())
                .unwrap_or("");
            zip.start_file(format!("database/{}", wal_name), options)?;
            let mut wal_file = File::open(&wal_path)?;
            io::copy(&mut wal_file, &mut zip)?;
        }
    }

    // 3. Add image cache
    if image_cache_root.exists() {
        for entry in WalkDir::new(image_cache_root)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let entry_path = entry.path();
            let relative = entry_path
                .strip_prefix(image_cache_root)
                .unwrap_or(entry_path);
            let archive_path = format!("images/{}", relative.display());

            zip.start_file(&archive_path, options)?;
            let mut img_file = File::open(entry_path)?;
            let size = io::copy(&mut img_file, &mut zip)?;

            image_count += 1;
            images_size += size;
        }
        log::info!(
            "Backup: {} images ({} bytes)",
            image_count,
            images_size
        );
    }

    // 4. Add metadata JSON
    let total_size = db_size + images_size;
    let metadata = BackupMetadata {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        backup_date: Utc::now().to_rfc3339(),
        db_file: db_path
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or("unknown")
            .to_string(),
        image_count,
        total_size_bytes: total_size,
    };
    let metadata_json = serde_json::to_string_pretty(&metadata)?;
    zip.start_file("backup_info.json", options)?;
    zip.write_all(metadata_json.as_bytes())?;

    zip.finish()?;

    log::info!(
        "Backup complete: {} (total {} bytes)",
        output_path.display(),
        total_size
    );

    Ok(BackupResult {
        output_path: output_path.to_string_lossy().to_string(),
        db_size_bytes: db_size,
        image_count,
        images_size_bytes: images_size,
        total_size_bytes: total_size,
    })
}

/// Generate a default backup filename with timestamp
pub fn default_backup_filename() -> String {
    let now = Utc::now().format("%Y%m%d_%H%M%S");
    format!("moviemanager_backup_{}.zip", now)
}
