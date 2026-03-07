-- ============================================================================
-- 004_media.sql — Versions, fichiers physiques, liaison multi-épisodes
-- ============================================================================

-- --------------------------------------------------------------------------
-- Media Versions (polymorphique : movie ou episode)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_versions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_type      TEXT    NOT NULL CHECK (owner_type IN ('movie', 'episode')),
    owner_id        INTEGER NOT NULL,               -- FK vers movies.id ou episodes.id
    label           TEXT,                           -- "4K HDR", "Director's Cut", "1080p HEVC"...
    quality_score   TEXT    CHECK (quality_score IN ('A', 'B', 'C', 'D')),

    -- Métadonnées techniques agrégées (extraites du fichier principal)
    resolution      TEXT,                           -- "3840x2160", "1920x1080"...
    video_codec     TEXT,                           -- "hevc", "h264", "av1"...
    audio_codec     TEXT,                           -- "aac", "ac3", "truehd"...
    audio_channels  TEXT,                           -- "stereo", "5.1", "7.1"...
    video_bitrate   INTEGER,                        -- Bitrate vidéo en kbps
    audio_bitrate   INTEGER,                        -- Bitrate audio en kbps
    hdr_format      TEXT,                           -- "HDR10", "Dolby Vision", NULL...
    container       TEXT,                           -- "mkv", "mp4", "avi"...
    duration        INTEGER,                        -- Durée en secondes (FFprobe)

    notes           TEXT,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_media_versions_owner ON media_versions(owner_type, owner_id);
CREATE INDEX idx_media_versions_quality ON media_versions(quality_score);

-- --------------------------------------------------------------------------
-- Media Files (fichiers physiques sur disque)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_files (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    media_version_id    INTEGER NOT NULL REFERENCES media_versions(id) ON DELETE CASCADE,
    library_id          INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    file_path           TEXT    NOT NULL,            -- Chemin relatif dans la library
    file_name           TEXT    NOT NULL,            -- Nom du fichier
    file_size           INTEGER,                    -- Taille en octets
    file_hash           TEXT,                       -- SHA256 (pour détection doublons exacts)
    last_seen           DATETIME,                   -- Dernière vérification de présence
    is_available        BOOLEAN NOT NULL DEFAULT 1,  -- Fichier accessible actuellement

    created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at          DATETIME NOT NULL DEFAULT (datetime('now')),

    UNIQUE(library_id, file_path)
);

CREATE INDEX idx_media_files_version  ON media_files(media_version_id);
CREATE INDEX idx_media_files_library  ON media_files(library_id);
CREATE INDEX idx_media_files_hash     ON media_files(file_hash);

-- --------------------------------------------------------------------------
-- Episode ↔ Media Version (liaison multi-épisodes)
-- Un fichier vidéo peut contenir plusieurs épisodes (ex: S01E01E02)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS episode_media_versions (
    episode_id          INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    media_version_id    INTEGER NOT NULL REFERENCES media_versions(id) ON DELETE CASCADE,

    PRIMARY KEY (episode_id, media_version_id)
);

CREATE INDEX idx_emv_episode ON episode_media_versions(episode_id);
CREATE INDEX idx_emv_version ON episode_media_versions(media_version_id);
