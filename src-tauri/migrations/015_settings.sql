-- ============================================================================
-- 015_settings.sql — Table de réglages applicatifs (clé / valeur)
-- ============================================================================
-- Utilisée pour persister les préférences de l'utilisateur :
-- ex. poids du score qualité, langue par défaut, etc.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
