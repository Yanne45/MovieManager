-- ============================================================================
-- 003_series.sql — Séries TV, saisons, épisodes
-- ============================================================================

-- --------------------------------------------------------------------------
-- Series
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    original_title  TEXT,
    sort_title      TEXT,                           -- Titre pour le tri
    overview        TEXT,                           -- Synopsis général
    first_air_date  DATE,                           -- Début de diffusion
    last_air_date   DATE,                           -- Fin de diffusion (NULL si en cours)
    status          TEXT    NOT NULL DEFAULT 'ongoing'
                    CHECK (status IN ('ongoing', 'ended', 'cancelled', 'archived')),
    total_seasons   INTEGER,                        -- Nombre total de saisons (ref TMDB)
    total_episodes  INTEGER,                        -- Nombre total d'épisodes (ref TMDB)
    content_rating  TEXT,
    poster_path     TEXT,
    backdrop_path   TEXT,
    is_placeholder  BOOLEAN NOT NULL DEFAULT 0,      -- Matching requis
    owned           BOOLEAN NOT NULL DEFAULT 1,      -- 0 = wishlist série

    -- Identifiants externes
    tmdb_id         INTEGER UNIQUE,
    imdb_id         TEXT    UNIQUE,
    tvdb_id         INTEGER UNIQUE,

    notes           TEXT,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_series_title        ON series(title);
CREATE INDEX idx_series_status       ON series(status);
CREATE INDEX idx_series_tmdb_id      ON series(tmdb_id);
CREATE INDEX idx_series_sort_title   ON series(sort_title);
CREATE INDEX idx_series_placeholder  ON series(is_placeholder);

-- --------------------------------------------------------------------------
-- Seasons
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seasons (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    season_number   INTEGER NOT NULL,               -- 0 = Specials
    title           TEXT,                           -- Titre optionnel
    overview        TEXT,
    air_date        DATE,
    episode_count   INTEGER,                        -- Nombre d'épisodes (ref TMDB)
    poster_path     TEXT,

    tmdb_id         INTEGER,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),

    UNIQUE(series_id, season_number)
);

CREATE INDEX idx_seasons_series_id ON seasons(series_id);

-- --------------------------------------------------------------------------
-- Episodes
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS episodes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    season_id       INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    episode_number  INTEGER NOT NULL,               -- Numéro dans la saison
    absolute_number INTEGER,                        -- Numérotation absolue (anime)
    title           TEXT,
    overview        TEXT,
    air_date        DATE,
    runtime         INTEGER,                        -- Durée en minutes
    has_file        BOOLEAN NOT NULL DEFAULT 0,      -- Calculé auto (cache)
    thumbnail_path  TEXT,                           -- Vignette (FFmpeg ou TMDB)

    tmdb_id         INTEGER,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),

    UNIQUE(season_id, episode_number)
);

CREATE INDEX idx_episodes_series_id  ON episodes(series_id);
CREATE INDEX idx_episodes_season_id  ON episodes(season_id);
CREATE INDEX idx_episodes_has_file   ON episodes(has_file);
