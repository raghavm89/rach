-- ── 090_agent_api_keys.sql ───────────────────────────────────────────────────
-- Workspace API keys for programmatic access to deployed agents. The secret is
-- shown once at creation and stored only as a SHA-256 hash; `prefix` is a short
-- non-secret label for the UI. A valid key raises the message endpoint from the
-- anonymous widget tier to the API tier and attributes usage.

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL DEFAULT 'API key',
  key_hash     TEXT    NOT NULL,
  prefix       TEXT    NOT NULL,                 -- e.g. 'sk_live_ab12cd'
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_api_keys_tenant ON agent_api_keys (tenant_id);
