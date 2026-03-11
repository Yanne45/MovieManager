-- ============================================================================
-- 017_operation_tracking.sql — Groupement des changements par operation
-- ============================================================================

ALTER TABLE change_log ADD COLUMN operation_id TEXT; -- UUID groupant les changements d'une meme operation

CREATE INDEX idx_cl_operation ON change_log(operation_id);
