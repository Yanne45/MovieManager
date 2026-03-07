-- ============================================================================
-- 010_system.sql — Traçabilité, audit, règles, inbox de résolution
-- ============================================================================

-- --------------------------------------------------------------------------
-- Fetch Sources — Provenance de chaque donnée
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fetch_sources (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT    NOT NULL,               -- "movie", "series", "episode", "person"...
    entity_id       INTEGER NOT NULL,
    field           TEXT    NOT NULL,               -- Champ concerné ("title", "overview", "runtime"...)
    source          TEXT    NOT NULL,               -- "scan", "tmdb", "omdb", "tvdb", "manual", "nfo"
    source_id       TEXT,                           -- ID externe (ex: TMDB id de la requête)
    fetched_at      DATETIME NOT NULL DEFAULT (datetime('now')),

    UNIQUE(entity_type, entity_id, field, source)
);

CREATE INDEX idx_fs_entity ON fetch_sources(entity_type, entity_id);
CREATE INDEX idx_fs_source ON fetch_sources(source);

-- --------------------------------------------------------------------------
-- Change Log — Historique & audit de toutes les modifications
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type     TEXT    NOT NULL,               -- Table concernée
    entity_id       INTEGER NOT NULL,
    field           TEXT    NOT NULL,               -- Champ modifié
    old_value       TEXT,
    new_value       TEXT,
    source          TEXT    NOT NULL,               -- "scan", "tmdb", "manual", "rule", "import"
    timestamp       DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_cl_entity    ON change_log(entity_type, entity_id);
CREATE INDEX idx_cl_timestamp ON change_log(timestamp);
CREATE INDEX idx_cl_source    ON change_log(source);

-- --------------------------------------------------------------------------
-- Rules — Règles d'automatisation (conditions → actions)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,               -- Nom descriptif de la règle
    is_active       BOOLEAN NOT NULL DEFAULT 1,
    priority        INTEGER NOT NULL DEFAULT 0,      -- Ordre d'exécution
    conditions      TEXT    NOT NULL,               -- JSON : [{field, operator, value}]
    actions         TEXT    NOT NULL,               -- JSON : [{action, params}]
    last_run        DATETIME,
    run_count       INTEGER NOT NULL DEFAULT 0,      -- Nombre de fois appliquée

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rules_active ON rules(is_active);

-- --------------------------------------------------------------------------
-- Inbox Items — Résolution des correspondances
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category        TEXT    NOT NULL
                    CHECK (category IN ('unrecognized', 'conflict', 'low_confidence', 'placeholder')),
    status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'resolved', 'ignored')),

    -- Contexte du fichier / de l'entité concernée
    file_path       TEXT,                           -- Chemin du fichier source (si applicable)
    parsed_title    TEXT,                           -- Titre extrait du parsing
    parsed_year     INTEGER,                        -- Année extraite
    parsed_season   INTEGER,                        -- Saison extraite (séries)
    parsed_episode  TEXT,                           -- Épisode(s) extrait(s) (peut être "01E02" pour multi)

    -- Entité liée (si matching partiel effectué)
    entity_type     TEXT,                           -- "movie" ou "series"
    entity_id       INTEGER,                        -- FK vers movies ou series

    -- Candidats de matching (JSON : [{tmdb_id, title, year, confidence}])
    match_candidates TEXT,

    -- Résolution
    resolved_at     DATETIME,
    resolution_note TEXT,                           -- Action prise ("linked to movie #42", "ignored")

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_inbox_status   ON inbox_items(status);
CREATE INDEX idx_inbox_category ON inbox_items(category);
CREATE INDEX idx_inbox_pending  ON inbox_items(status, category) WHERE status = 'pending';
