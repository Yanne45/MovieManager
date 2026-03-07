-- ============================================================================
-- 002_movies.sql — Fiches films
-- ============================================================================

CREATE TABLE IF NOT EXISTS movies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,                -- Titre principal (FR ou local)
    original_title  TEXT,                            -- Titre original (VO)
    sort_title      TEXT,                            -- Titre pour le tri (sans articles)
    overview        TEXT,                            -- Synopsis
    year            INTEGER,                        -- Année de sortie
    release_date    DATE,                           -- Date de sortie précise
    runtime         INTEGER,                        -- Durée en minutes
    content_rating  TEXT,                           -- Classification (PG, R, etc.)
    tagline         TEXT,                           -- Accroche / tagline
    poster_path     TEXT,                           -- Chemin affiche principale (cache local)
    backdrop_path   TEXT,                           -- Chemin fanart / bannière
    owned           BOOLEAN NOT NULL DEFAULT 1,      -- 0 = wishlist (film recherché, pas de fichier)
    is_placeholder  BOOLEAN NOT NULL DEFAULT 0,      -- Fiche créée auto en attente de matching

    -- Identifiants externes pour le matching
    tmdb_id         INTEGER UNIQUE,
    imdb_id         TEXT    UNIQUE,                  -- Format "tt1234567"

    -- Métadonnées techniques agrégées (cache depuis media_versions)
    primary_quality_score TEXT CHECK (primary_quality_score IN ('A', 'B', 'C', 'D')),

    notes           TEXT,                           -- Notes libres utilisateur

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Index principaux
CREATE INDEX idx_movies_title        ON movies(title);
CREATE INDEX idx_movies_year         ON movies(year);
CREATE INDEX idx_movies_owned        ON movies(owned);
CREATE INDEX idx_movies_tmdb_id      ON movies(tmdb_id);
CREATE INDEX idx_movies_imdb_id      ON movies(imdb_id);
CREATE INDEX idx_movies_sort_title   ON movies(sort_title);
CREATE INDEX idx_movies_placeholder  ON movies(is_placeholder);
