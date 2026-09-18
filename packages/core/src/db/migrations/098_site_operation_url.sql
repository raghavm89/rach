-- 098_site_operation_url.sql
-- Surface the deployed app's public URL on the operation. The site reports
-- status.url on an App once it is ACTIVE (workload reconciler); the status-poll
-- worker reflects it here so GET /operations can hand the URL to the dashboard.
-- RachBase-only; harmless in rach_dev_db where the shared migration set also runs.

ALTER TABLE site_operations ADD COLUMN IF NOT EXISTS url TEXT;

-- Reversal:
--   ALTER TABLE site_operations DROP COLUMN IF EXISTS url;
