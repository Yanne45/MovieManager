-- ============================================================================
-- 007_junction_movies.sql — Liaisons many-to-many pour les films
-- ============================================================================

-- --------------------------------------------------------------------------
-- Movie ↔ People (acteurs, réalisateurs, producteurs)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movie_people (
    movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    person_id       INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    role            TEXT    NOT NULL DEFAULT 'actor'
                    CHECK (role IN ('actor', 'director', 'producer', 'writer', 'composer', 'other')),
    character_name  TEXT,                           -- Nom du personnage (pour les acteurs)
    credit_order    INTEGER,                        -- Ordre dans le casting

    PRIMARY KEY (movie_id, person_id, role)
);

CREATE INDEX idx_mp_movie  ON movie_people(movie_id);
CREATE INDEX idx_mp_person ON movie_people(person_id);
CREATE INDEX idx_mp_role   ON movie_people(role);

-- --------------------------------------------------------------------------
-- Movie ↔ Tags
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movie_tags (
    movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

    PRIMARY KEY (movie_id, tag_id)
);

CREATE INDEX idx_mt_movie ON movie_tags(movie_id);
CREATE INDEX idx_mt_tag   ON movie_tags(tag_id);

-- --------------------------------------------------------------------------
-- Movie ↔ Genres
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id        INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,

    PRIMARY KEY (movie_id, genre_id)
);

CREATE INDEX idx_mg_movie ON movie_genres(movie_id);
CREATE INDEX idx_mg_genre ON movie_genres(genre_id);

-- --------------------------------------------------------------------------
-- Movie ↔ Studios
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movie_studios (
    movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    studio_id       INTEGER NOT NULL REFERENCES studios(id) ON DELETE CASCADE,

    PRIMARY KEY (movie_id, studio_id)
);

CREATE INDEX idx_ms_movie  ON movie_studios(movie_id);
CREATE INDEX idx_ms_studio ON movie_studios(studio_id);
