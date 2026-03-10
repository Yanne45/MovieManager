-- ============================================================================
-- 014_volume_label.sql — Ajout libellé du volume disque sur les libraries
-- ============================================================================
-- volume_label : libellé du disque/partition lu via l'OS au moment de la création
--                ex. "Films HDD", "NAS Salon", "Seagate 4To"
-- ============================================================================

ALTER TABLE libraries ADD COLUMN volume_label TEXT;
