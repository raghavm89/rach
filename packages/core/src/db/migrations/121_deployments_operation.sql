-- 121_deployments_operation.sql
-- Link a deploy-history row to the site operation it triggered, so the operation's terminal
-- outcome (SUCCEEDED/FAILED) can be reflected onto the RIGHT deployment row — "latest row"
-- guessing breaks with concurrent deploys. Nullable (source builds may resolve later).
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS operation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_deployments_operation ON deployments (operation_id) WHERE operation_id IS NOT NULL;

-- Reversal:
--   DROP INDEX IF EXISTS idx_deployments_operation;
--   ALTER TABLE deployments DROP COLUMN IF EXISTS operation_id;
