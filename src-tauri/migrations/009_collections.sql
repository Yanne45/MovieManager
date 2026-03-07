-- ============================================================================
-- 009_collections.sql — Listes manuelles de l'utilisateur
-- ============================================================================

-- --------------------------------------------------------------------------
-- Collections (listes personnalisées)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collections (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    description     TEXT,
    poster_path     TEXT,                           -- Image optionnelle pour la collection

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_collections_name ON collections(name);

-- --------------------------------------------------------------------------
-- Collection Items (films ou séries dans une collection, avec ordre)
-- Un seul de movie_id / series_id est rempli par ligne
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS collection_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id   INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    movie_id        INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    series_id       INTEGER REFERENCES series(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL DEFAULT 0,      -- Ordre dans la collection (drag & drop)
    notes           TEXT,                           -- Note optionnelle sur l'item

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),

    -- Un seul des deux doit être renseigné
    CHECK ((movie_id IS NOT NULL AND series_id IS NULL) OR
           (movie_id IS NULL AND series_id IS NOT NULL))
);

CREATE INDEX idx_ci_collection ON collection_items(collection_id);
CREATE INDEX idx_ci_movie      ON collection_items(movie_id);
CREATE INDEX idx_ci_series     ON collection_items(series_id);
CREATE INDEX idx_ci_position   ON collection_items(collection_id, position);
