-- ============================================================================
-- 011_images.sql — Image cache (multi-size, one row per entity+type)
-- ============================================================================
-- Each entity (movie, series, season, etc.) has one row per image type
-- (poster, backdrop, etc.) storing paths for all 3 cache sizes.
-- The poster_path / backdrop_path on entity tables keep the TMDB path
-- for re-downloading; this table stores local cached paths.
-- ============================================================================

CREATE TABLE IF NOT EXISTS images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Polymorphic link
    entity_type     TEXT    NOT NULL
                    CHECK (entity_type IN ('movie', 'series', 'season', 'episode', 'person', 'studio', 'collection')),
    entity_id       INTEGER NOT NULL,

    -- Image type
    image_type      TEXT    NOT NULL
                    CHECK (image_type IN ('poster', 'backdrop', 'thumbnail', 'still', 'logo', 'photo', 'banner')),

    -- Source URL (TMDB path like "/abc123.jpg")
    source_url      TEXT,

    -- Cached local paths (relative to image cache root)
    path_thumb      TEXT,                           -- w92  — table rows
    path_medium     TEXT,                           -- w342 — detail panel
    path_large      TEXT,                           -- w500 — gallery view

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),

    -- One image per entity+type combination
    UNIQUE(entity_type, entity_id, image_type)
);

CREATE INDEX idx_images_entity ON images(entity_type, entity_id);
