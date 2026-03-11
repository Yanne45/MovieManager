-- ============================================================================
-- 016_smart_collections.sql — Collections dynamiques basees sur des regles
-- ============================================================================

ALTER TABLE collections ADD COLUMN is_smart INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collections ADD COLUMN smart_rules TEXT; -- JSON: { match: "all"|"any", rules: [...] }
