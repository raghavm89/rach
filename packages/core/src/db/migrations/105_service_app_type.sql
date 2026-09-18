-- 105_service_app_type.sql
-- Auto-detected "type of app" for a GitHub-repo service (node, python, postgres, static, …),
-- decoded from the repo at creation time. Drives the default Docker Hub deploy image (stored
-- in services.image) — a smart default the user can still override (BYOI). RachBase-only.

ALTER TABLE services ADD COLUMN IF NOT EXISTS app_type TEXT;

-- Reversal:
--   ALTER TABLE services DROP COLUMN IF EXISTS app_type;
