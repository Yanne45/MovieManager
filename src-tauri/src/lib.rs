mod commands;
mod db;
mod modules;

use db::Database;
use modules::image_cache::ImageCache;
use modules::tmdb::TmdbClient;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::Manager;

// ============================================================================
// App State — multi-database support
// ============================================================================

/// Application state shared across all Tauri commands
pub struct AppState {
    pub db: RwLock<Database>,
    pub tmdb: RwLock<Option<TmdbClient>>,
    pub image_cache: RwLock<ImageCache>,
    pub app_data_dir: PathBuf,
}

impl AppState {
    /// Get a clone of the current database (for use in async commands)
    pub fn db(&self) -> Database {
        self.db.read().expect("DB lock poisoned").clone()
    }

    /// Get TMDB client if configured
    pub fn get_tmdb(&self) -> Option<TmdbClient> {
        // Check existing
        {
            let guard = self.tmdb.read().ok()?;
            if let Some(ref client) = *guard {
                return Some(client.clone());
            }
        }

        // Try to initialize from env var
        if let Ok(key) = std::env::var("TMDB_API_KEY") {
            let lang = std::env::var("TMDB_LANGUAGE").unwrap_or_else(|_| "fr-FR".to_string());
            let client = TmdbClient::new(&key, &lang);
            if let Ok(mut w) = self.tmdb.write() {
                *w = Some(client.clone());
            }
            return Some(client);
        }

        None
    }
}

/// Recent database entry (stored in a JSON file)
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct RecentDatabase {
    pub path: String,
    pub name: String,
    pub last_opened: String,
}

/// Read the recent databases list from the app data dir
fn load_recent_databases(app_data_dir: &std::path::Path) -> Vec<RecentDatabase> {
    let path = app_data_dir.join("recent_databases.json");
    if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

/// Save the recent databases list
fn save_recent_databases(app_data_dir: &std::path::Path, list: &[RecentDatabase]) {
    let path = app_data_dir.join("recent_databases.json");
    if let Ok(json) = serde_json::to_string_pretty(list) {
        let _ = std::fs::write(path, json);
    }
}

/// Add or update a database in the recent list
pub fn touch_recent_database(app_data_dir: &std::path::Path, db_path: &str, name: &str) {
    let mut list = load_recent_databases(app_data_dir);
    // Remove existing entry if present
    list.retain(|r| r.path != db_path);
    // Add at front
    list.insert(0, RecentDatabase {
        path: db_path.to_string(),
        name: name.to_string(),
        last_opened: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
    });
    // Keep max 10
    list.truncate(10);
    save_recent_databases(app_data_dir, &list);
}

// ============================================================================
// Tauri entry point
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            // Open default database (or last used)
            let recent = load_recent_databases(&app_data_dir);
            let db_path = if let Some(last) = recent.first() {
                PathBuf::from(&last.path)
            } else {
                app_data_dir.join("moviemanager.db")
            };

            let db = tauri::async_runtime::block_on(async {
                Database::new(&db_path)
                    .await
                    .expect("Failed to initialize database")
            });

            // Record in recent list
            touch_recent_database(&app_data_dir, &db_path.to_string_lossy(), &db.name());

            // Image cache (per-database subdirectory)
            let cache_dir = app_data_dir.join("image_cache");
            let image_cache = ImageCache::new(&cache_dir);
            image_cache.ensure_dirs().expect("Failed to create image cache dirs");

            // TMDB client
            let tmdb = std::env::var("TMDB_API_KEY").ok().map(|key| {
                let lang = std::env::var("TMDB_LANGUAGE").unwrap_or_else(|_| "fr-FR".to_string());
                TmdbClient::new(&key, &lang)
            });

            app.manage(AppState {
                db: RwLock::new(db),
                tmdb: RwLock::new(tmdb),
                image_cache: RwLock::new(image_cache),
                app_data_dir: app_data_dir.clone(),
            });

            log::info!("MovieManager initialized — DB at {:?}", db_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Database management
            commands::database::get_current_database,
            commands::database::get_recent_databases,
            commands::database::create_database,
            commands::database::open_database,
            // Library commands
            commands::libraries::get_libraries,
            commands::libraries::create_library,
            commands::libraries::update_library,
            commands::libraries::delete_library,
            // Movie commands
            commands::movies::get_movies,
            commands::movies::get_movie,
            commands::movies::create_movie,
            commands::movies::update_movie,
            commands::movies::delete_movie,
            commands::movies::get_movie_versions,
            commands::movies::get_version_files,
            commands::movies::get_similar_movies,
            commands::movies::find_exact_duplicates,
            commands::movies::find_probable_duplicates,
            commands::movies::find_multi_version_movies,
            // Series commands
            commands::series::get_series_list,
            commands::series::get_series_detail,
            commands::series::update_series,
            // Tag commands
            commands::tags::get_tags,
            commands::tags::create_tag,
            commands::tags::delete_tag,
            commands::tags::get_genres,
            commands::tags::create_genre,
            commands::tags::get_movie_genres,
            // Scan commands
            commands::scan::scan_library,
            commands::scan::scan_and_match_library,
            commands::scan::import_dropped_paths,
            // TMDB commands
            commands::tmdb::search_movie_tmdb,
            commands::tmdb::search_series_tmdb,
            commands::tmdb::set_tmdb_api_key,
            // Analysis commands (FFprobe)
            commands::analysis::analyze_media_file,
            commands::analysis::analyze_movie_files,
            commands::analysis::analyze_library,
            commands::analysis::check_ffprobe,
            // Rules commands
            commands::rules::get_rules,
            commands::rules::create_rule,
            commands::rules::toggle_rule,
            commands::rules::delete_rule,
            commands::rules::apply_rules_library,
            // History commands
            commands::history::get_entity_history,
            commands::history::get_recent_changes,
            commands::history::rollback_change,
            // Inbox commands
            commands::inbox::get_inbox_items,
            commands::inbox::get_inbox_count,
            commands::inbox::resolve_inbox_link,
            commands::inbox::resolve_inbox_ignore,
            commands::inbox::reopen_inbox_item,
            commands::inbox::delete_inbox_item,
            // Image commands
            commands::images::get_image_paths,
            commands::images::get_image_cache_root,
            // People commands
            commands::people::get_people,
            commands::people::get_person,
            commands::people::create_person,
            commands::people::update_person,
            commands::people::delete_person,
            commands::people::get_movie_people,
            commands::people::add_movie_person,
            commands::people::remove_movie_person,
            // Studios commands
            commands::studios::get_studios,
            commands::studios::create_studio,
            commands::studios::update_studio,
            commands::studios::delete_studio,
            commands::studios::get_movie_studios,
            commands::studios::add_movie_studio,
            commands::studios::remove_movie_studio,
            // Collections commands
            commands::collections::get_collections,
            commands::collections::create_collection,
            commands::collections::update_collection,
            commands::collections::delete_collection,
            commands::collections::get_collection_items,
            commands::collections::add_collection_item,
            commands::collections::remove_collection_item,
            commands::collections::reorder_collection_item,
            // Episodes commands
            commands::episodes::update_episode,
            // Stats commands
            commands::stats::get_dashboard_stats,
            commands::stats::get_genre_stats,
            commands::stats::get_recent_additions,
            commands::stats::get_recently_added_movies,
            commands::stats::get_incomplete_series,
            commands::stats::get_wishlist_movies,
            // Backup commands
            commands::backup::create_backup,
            commands::backup::get_backup_filename,
            // NFO import commands
            commands::nfo::parse_nfo,
            commands::nfo::scan_nfo_directory,
            commands::nfo::import_nfo_files,
            commands::nfo::import_nfo_directory,
            // Export commands
            commands::export::export_json,
            commands::export::export_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running MovieManager");
}
