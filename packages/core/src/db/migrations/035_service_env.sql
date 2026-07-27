-- 035_service_env.sql
-- Per-service environment variables (PaaS phase 1). Secret values are encrypted
-- at rest with the same AES-256-GCM envelope (keyCrypto) used for VM keys; they
-- are decrypted only in memory when read/deployed.

CREATE TABLE IF NOT EXISTS deployment_service_env (
  id         SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES deployment_services(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value_enc  TEXT NOT NULL,            -- keyCrypto.seal(value)
  is_secret  BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, key)
);

CREATE INDEX IF NOT EXISTS idx_deployment_service_env_service ON deployment_service_env(service_id);
