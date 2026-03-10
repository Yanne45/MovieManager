pub mod models;
pub mod queries;

use anyhow::Result;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::path::{Path, PathBuf};
use std::str::FromStr;

/// Main database wrapper — supports switching between databases at runtime
#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
    path: PathBuf,
}

impl Database {
    /// Create a new database connection and run migrations
    pub async fn new(db_path: &Path) -> Result<Self> {
        let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

        let options = SqliteConnectOptions::from_str(&db_url)?
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await?;

        let db = Self {
            pool,
            path: db_path.to_path_buf(),
        };
        db.run_migrations().await?;

        log::info!("Database initialized at {}", db_path.display());
        Ok(db)
    }

    /// Close the current connection pool
    pub async fn close(&self) {
        self.pool.close().await;
    }

    /// Run all SQL migration files in order
    async fn run_migrations(&self) -> Result<()> {
        let migrations = vec![
            ("001_libraries", include_str!("../../migrations/001_libraries.sql")),
            ("002_movies", include_str!("../../migrations/002_movies.sql")),
            ("003_series", include_str!("../../migrations/003_series.sql")),
            ("004_media", include_str!("../../migrations/004_media.sql")),
            ("005_people_studios", include_str!("../../migrations/005_people_studios.sql")),
            ("006_tags_genres", include_str!("../../migrations/006_tags_genres.sql")),
            ("007_junction_movies", include_str!("../../migrations/007_junction_movies.sql")),
            ("008_junction_series", include_str!("../../migrations/008_junction_series.sql")),
            ("009_collections", include_str!("../../migrations/009_collections.sql")),
            ("010_system", include_str!("../../migrations/010_system.sql")),
            ("011_images", include_str!("../../migrations/011_images.sql")),
            ("012_rules_update", include_str!("../../migrations/012_rules_update.sql")),
            ("013_images_multi", include_str!("../../migrations/013_images_multi.sql")),
            ("014_volume_label", include_str!("../../migrations/014_volume_label.sql")),
            ("015_settings", include_str!("../../migrations/015_settings.sql")),
        ];

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS _migrations (
                name TEXT PRIMARY KEY,
                applied_at DATETIME NOT NULL DEFAULT (datetime('now'))
            )"
        )
        .execute(&self.pool)
        .await?;

        for (name, sql) in migrations {
            let applied: Option<(String,)> = sqlx::query_as(
                "SELECT name FROM _migrations WHERE name = ?"
            )
            .bind(name)
            .fetch_optional(&self.pool)
            .await?;

            if applied.is_none() {
                log::info!("Applying migration: {}", name);
                sqlx::raw_sql(sql).execute(&self.pool).await?;
                sqlx::query("INSERT INTO _migrations (name) VALUES (?)")
                    .bind(name)
                    .execute(&self.pool)
                    .await?;
            }
        }

        log::info!("All migrations applied");
        Ok(())
    }

    /// Get a reference to the connection pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Get the current database file path
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Get database file name (for display)
    pub fn name(&self) -> String {
        self.path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "Sans nom".into())
    }
}
