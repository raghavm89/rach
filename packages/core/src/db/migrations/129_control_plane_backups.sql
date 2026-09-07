-- 129_control_plane_backups.sql
-- Control-plane database backups ride the existing baas_backups pipeline
-- (kind='control_plane'), recorded with project_id NULL — there is no project row for the
-- control plane itself. The go-live audit's #1 finding was that the control-plane DB
-- (users, tenants, billing, subscriptions, outbox) had no backup automation at all.
--
-- Non-destructive: only relaxes the NOT NULL constraint; existing rows are untouched.

ALTER TABLE baas_backups ALTER COLUMN project_id DROP NOT NULL;

-- Fast "was there a control-plane backup today?" lookups for the worker.
CREATE INDEX IF NOT EXISTS idx_baas_backups_control
  ON baas_backups (started_at DESC)
  WHERE project_id IS NULL AND kind = 'control_plane';

-- Reversal (only safe once all project_id-NULL rows are removed):
--   DELETE FROM baas_backups WHERE project_id IS NULL;
--   DROP INDEX IF EXISTS idx_baas_backups_control;
--   ALTER TABLE baas_backups ALTER COLUMN project_id SET NOT NULL;
