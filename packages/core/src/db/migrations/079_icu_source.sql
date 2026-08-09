-- ── 079_icu_source.sql ───────────────────────────────────────────────────────
-- Umeed: record where an ICU observation came from — a bedside device gateway
-- (monitors / ventilator / infusion pumps / LIS) or manual entry. The evaluation
-- and alerting path is identical either way; this only tags provenance so the
-- board and audit can distinguish live device feeds from hand-charted vitals.

ALTER TABLE icu_observations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';  -- manual | device
ALTER TABLE icu_observations ADD COLUMN IF NOT EXISTS device_id TEXT;                          -- e.g. monitor/bay id
