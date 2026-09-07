-- Phase 3 BaaS: per-project Auth configuration (Supabase-parity Authentication settings —
-- signups, providers, sessions, rate limits, URL config). Control-plane state: editable before
-- the backend deploys and injected into the Auth container's env at deploy time. Stored as a
-- JSONB blob so the schema can grow without further migrations.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS auth_config JSONB NOT NULL DEFAULT '{}'::jsonb;
