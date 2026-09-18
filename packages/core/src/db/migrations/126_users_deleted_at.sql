-- 126_users_deleted_at.sql
-- Right to erasure (DPDP §12): a self-service account deletion anonymizes the user's PII in place
-- and stamps deleted_at, rather than hard-deleting — so invoices (a legally-retained financial
-- record) keep referential integrity while the person's identity is removed. Login by the old
-- email no longer works because the email is rewritten to a non-routable placeholder.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- Reversal:
--   DROP INDEX IF EXISTS idx_users_deleted_at;
--   ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
