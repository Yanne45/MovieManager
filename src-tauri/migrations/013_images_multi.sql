-- ============================================================================
-- 013_images_multi.sql — Multi-image support + position ordering
-- ============================================================================
-- Changes:
--   - Drop UNIQUE(entity_type, entity_id, image_type) to allow galleries
--   - Add `position` column for ordering within a type
--   - Add `entity_slug` for filename generation
--   - Partial unique index: poster/logo/thumbnail stay single per entity
-- ============================================================================

-- Recreate table (SQLite cannot ALTER constraints)
CREATE TABLE IF NOT EXISTS images_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,

    entity_type     TEXT    NOT NULL
                    CHECK (entity_type IN ('movie', 'series', 'season', 'episode', 'person', 'studio', 'collection')),
    entity_id       INTEGER NOT NULL,

    image_type      TEXT    NOT NULL
                    CHECK (image_type IN ('poster', 'backdrop', 'thumbnail', 'still', 'logo', 'photo', 'banner')),

    source_url      TEXT,

    path_thumb      TEXT,
    path_medium     TEXT,
    path_large      TEXT,

    position        INTEGER NOT NULL DEFAULT 0,
    entity_slug     TEXT    NOT NULL DEFAULT '',

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Migrate existing data
INSERT INTO images_new (id, entity_type, entity_id, image_type, source_url,
    path_thumb, path_medium, path_large, position, entity_slug, created_at, updated_at)
SELECT id, entity_type, entity_id, image_type, source_url,
    path_thumb, path_medium, path_large, 0, '', created_at, updated_at
FROM images;

DROP TABLE images;
ALTER TABLE images_new RENAME TO images;

-- General lookup index
CREATE INDEX idx_images_entity ON images(entity_type, entity_id);

-- Ordering index for gallery queries
CREATE INDEX idx_images_ordering ON images(entity_type, entity_id, image_type, position);

-- Enforce single image for poster, logo, thumbnail (partial unique index)
CREATE UNIQUE INDEX idx_images_single
    ON images(entity_type, entity_id, image_type)
    WHERE image_type IN ('poster', 'logo', 'thumbnail');
