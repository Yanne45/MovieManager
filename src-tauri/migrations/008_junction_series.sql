-- ============================================================================
-- 008_junction_series.sql — Liaisons many-to-many pour les séries
-- ============================================================================

-- --------------------------------------------------------------------------
-- Series ↔ People (casting principal, créateurs)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series_people (
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL DEFAULT 'actor'
                    CHECK (role IN ('actor', 'director', 'creator', 'producer', 'writer', 'composer', 'other')),
    character_name  TEXT,
    credit_order    INTEGER,

    PRIMARY KEY (series_id, person_id, role)
);

CREATE INDEX idx_sp_series ON series_people(series_id);
CREATE INDEX idx_sp_person ON series_people(person_id);

-- --------------------------------------------------------------------------
-- Episode ↔ People (guest stars, réalisateurs par épisode)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS episode_people (
    episode_id      INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL DEFAULT 'guest_star'
                    CHECK (role IN ('guest_star', 'director', 'writer', 'other')),
    character_name  TEXT,
    credit_order    INTEGER,

    PRIMARY KEY (episode_id, person_id, role)
);

CREATE INDEX idx_ep_episode ON episode_people(episode_id);
CREATE INDEX idx_ep_person  ON episode_people(person_id);

-- --------------------------------------------------------------------------
-- Series ↔ Tags
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series_tags (
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    PRIMARY KEY (series_id, tag_id)
);

CREATE INDEX idx_st_series ON series_tags(series_id);
CREATE INDEX idx_st_tag    ON series_tags(tag_id);

-- --------------------------------------------------------------------------
-- Series ↔ Genres
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series_genres (
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    genre_id        INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,

    PRIMARY KEY (series_id, genre_id)
);

CREATE INDEX idx_sg_series ON series_genres(series_id);
CREATE INDEX idx_sg_genre  ON series_genres(genre_id);

-- --------------------------------------------------------------------------
-- Series ↔ Studios
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series_studios (
    series_id       INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    studio_id       INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

    PRIMARY KEY (series_id, studio_id)
);

CREATE INDEX idx_ss_series ON series_studios(series_id);
CREATE INDEX idx_ss_studio ON series_studios(studio_id);
