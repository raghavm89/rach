-- Phase 3 BaaS: the per-project database connection string (sealed). The control plane
-- provisions a database + login role on the managed BaaS Postgres cluster and stores the
-- resulting connection string here; Auth + PostgREST consume it as DATABASE_URL / PGRST_DB_URI.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS db_url_enc TEXT;
