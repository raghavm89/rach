-- Phase 3 BaaS: per-project Storage configuration (Settings + S3) and the S3 access-key registry.
-- storage_config is control-plane JSONB (image transformation, global file-size limit, S3 protocol
-- toggle + region), injected into the Storage container at deploy. S3 access keys authenticate
-- S3-protocol clients; only the SHA-256 hash of the secret is stored.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS storage_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS baas_s3_keys (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '',
  access_key_id TEXT UNIQUE NOT NULL,
  secret_hash   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS baas_s3_keys_project_idx ON baas_s3_keys (project_id);
