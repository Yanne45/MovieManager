-- ============================================================================
-- 001_libraries.sql — Sources physiques (disques, NAS, archives)
-- ============================================================================

CREATE TABLE IF NOT EXISTS libraries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,                -- Nom lisible ("NAS Salon", "Disque Archive")
    path            TEXT    NOT NULL UNIQUE,         -- Chemin racine
    type            TEXT    NOT NULL DEFAULT 'hdd'   -- hdd / nas / archive / temporary
                    CHECK (type IN ('hdd', 'nas', 'archive', 'temporary')),
    is_online       BOOLEAN NOT NULL DEFAULT 1,      -- Statut de disponibilité
    last_scan       DATETIME,                        -- Date du dernier scan
    total_files     INTEGER NOT NULL DEFAULT 0,      -- Compteur fichiers (cache)
    total_size      INTEGER NOT NULL DEFAULT 0,      -- Taille totale en octets (cache)
    notes           TEXT,                            -- Notes libres utilisateur
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Index pour recherche rapide par statut
CREATE INDEX idx_libraries_is_online ON libraries(is_online);
