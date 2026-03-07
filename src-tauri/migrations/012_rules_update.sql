-- ============================================================================
-- 012_rules_update.sql — Align rules table with Rust code + rules_log
-- ============================================================================

-- Rename columns to match Rust struct expectations
-- SQLite doesn't support RENAME COLUMN before 3.25, so we recreate
ALTER TABLE rules RENAME TO rules_old;

CREATE TABLE IF NOT EXISTS rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    priority        INTEGER NOT NULL DEFAULT 100,
    condition_json  TEXT    NOT NULL,            -- JSON: {field, operator, value}
    action_json     TEXT    NOT NULL,            -- JSON: {action_type, value}
    last_run        DATETIME,
    run_count       INTEGER NOT NULL DEFAULT 0,

    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- Migrate existing data (map old column names to new)
INSERT INTO rules (id, name, enabled, priority, condition_json, action_json, last_run, run_count, created_at, updated_at)
SELECT id, name, is_active, priority, conditions, actions, last_run, run_count, created_at, updated_at
FROM rules_old;

DROP TABLE rules_old;

CREATE INDEX idx_rules_enabled ON rules(enabled);

-- --------------------------------------------------------------------------
-- Rules log — track which rules were applied to which entities
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rules_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id             INTEGER NOT NULL,
    entity_type         TEXT    NOT NULL,
    entity_id           INTEGER NOT NULL,
    action_description  TEXT,
    applied_at          DATETIME NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
);

CREATE INDEX idx_rules_log_rule    ON rules_log(rule_id);
CREATE INDEX idx_rules_log_entity  ON rules_log(entity_type, entity_id);
CREATE INDEX idx_rules_log_time    ON rules_log(applied_at);
