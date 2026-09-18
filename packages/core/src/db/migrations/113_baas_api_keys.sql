-- Phase 3 BaaS: opaque, individually-revocable API keys (Supabase's current model).
-- One publishable key + N secret keys per project. Only a SHA-256 hash is stored for lookup
-- (never the raw secret key); publishable keys additionally keep their plaintext since they're
-- public and need to be redisplayed. These supersede the legacy HS256 anon/service_role keys
-- (which are still minted from the project secret during the transition).

CREATE TABLE IF NOT EXISTS baas_api_keys (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('publishable','secret')),
  name         TEXT NOT NULL DEFAULT 'default',
  key_hash     TEXT NOT NULL,
  key_public   TEXT,                       -- plaintext for publishable keys (public); NULL for secret
  last4        TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS baas_api_keys_hash_uq ON baas_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS baas_api_keys_project_idx ON baas_api_keys (project_id) WHERE revoked_at IS NULL;

-- At most one active publishable key per project.
CREATE UNIQUE INDEX IF NOT EXISTS baas_api_keys_one_publishable
  ON baas_api_keys (project_id) WHERE type = 'publishable' AND revoked_at IS NULL;
