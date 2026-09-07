-- 120_site_outbox_deadletter.sql
-- Outbox hardening: a permanently-failing delivery (e.g. a 4xx/validation or a 5xx that
-- never recovers) must STOP retrying and surface the real reason, instead of looping forever
-- with a generic "no ack". Add a dead-letter marker + the last HTTP status; exclude failed
-- rows from the claim path.

ALTER TABLE site_outbox ADD COLUMN IF NOT EXISTS failed_at   TIMESTAMPTZ;
ALTER TABLE site_outbox ADD COLUMN IF NOT EXISTS last_status INTEGER;

-- The claim index must skip dead-lettered rows too (was: delivered_at IS NULL only).
DROP INDEX IF EXISTS idx_site_outbox_claimable;
CREATE INDEX IF NOT EXISTS idx_site_outbox_claimable
  ON site_outbox (available_at) WHERE delivered_at IS NULL AND failed_at IS NULL;

-- Reversal:
--   ALTER TABLE site_outbox DROP COLUMN IF EXISTS failed_at;
--   ALTER TABLE site_outbox DROP COLUMN IF EXISTS last_status;
