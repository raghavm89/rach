-- ── 084_tenant_integrations.sql ─────────────────────────────────────────────
-- Connector framework: per-tenant connections to external services (channels +
-- tools). Credentials are stored ENCRYPTED (AES-256-GCM) via the secretbox util
-- — the plaintext key/secret never sits in the DB. Non-secret config (account
-- id, channel name, shop domain, …) lives in `config` as JSONB.

CREATE TABLE IF NOT EXISTS tenant_integrations (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector             TEXT    NOT NULL,             -- 'razorpay' | 'stripe' | 'slack' | …
  status                TEXT    NOT NULL DEFAULT 'connected',  -- connected | disconnected
  credentials_encrypted TEXT,                          -- iv:tag:ciphertext (base64), or NULL
  config                JSONB   NOT NULL DEFAULT '{}'::jsonb,  -- non-secret config
  created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, connector)
);
CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant ON tenant_integrations (tenant_id);
