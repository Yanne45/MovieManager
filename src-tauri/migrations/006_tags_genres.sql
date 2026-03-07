-- ============================================================================
-- 006_tags_genres.sql — Tags libres et genres cinématographiques
-- ============================================================================

-- --------------------------------------------------------------------------
-- Tags (libres, créés par l'utilisateur + rules engine)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    color           TEXT,                           -- Couleur hex pour affichage (#FF6B6B)
    auto_generated  BOOLEAN NOT NULL DEFAULT 0,      -- Créé par le rules engine

    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_tags_name ON tags(name);

-- --------------------------------------------------------------------------
-- Genres cinématographiques
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS genres (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,

    tmdb_id         INTEGER UNIQUE,                 -- Correspondance TMDB

    created_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_genres_name ON genres(name);
