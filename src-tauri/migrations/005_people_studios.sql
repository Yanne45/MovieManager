-- ============================================================================
-- 005_people_studios.sql — Personnes et studios de production
-- ============================================================================

-- --------------------------------------------------------------------------
-- People (acteurs, réalisateurs, producteurs, créateurs)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    sort_name       TEXT,                           -- "Nolan, Christopher" pour tri alphabétique
    primary_role    TEXT,                           -- Rôle privilégié ("Acting", "Directing", "Writing"...)
    birth_date      DATE,
    birth_place     TEXT,                           -- Lieu de naissance
    death_date      DATE,
    biography       TEXT,
    photo_path      TEXT,                           -- Chemin portrait (cache local)
    known_for       TEXT,                           -- Domaine de notoriété (département TMDB)
    notes           TEXT,                           -- Notes libres utilisateur

    -- Identifiants externes
    tmdb_id         INTEGER UNIQUE,
    imdb_id         TEXT    UNIQUE,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_people_name     ON people(name);
CREATE INDEX idx_people_tmdb_id  ON people(tmdb_id);
CREATE INDEX idx_people_sort     ON people(sort_name);

-- --------------------------------------------------------------------------
-- Studios
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    logo_path       TEXT,                           -- Chemin logo (cache local)
    country         TEXT,                           -- Pays d'origine
    founded_date    DATE,                           -- Date de fondation
    description     TEXT,                           -- Description du studio
    notes           TEXT,                           -- Notes libres utilisateur

    tmdb_id         INTEGER UNIQUE,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_studios_name ON studios(name);
