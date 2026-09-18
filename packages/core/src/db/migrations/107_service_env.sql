-- Per-service environment variables + run command for SHARED (Pro) containers.
-- Mirrors the VM path (deployment_service_env): values are encrypted at rest with
-- keyCrypto (AES-256-GCM); is_secret only drives display masking. start_command is
-- the user's run command; NULL means "run the image's built-in ENTRYPOINT/CMD".

ALTER TABLE services ADD COLUMN IF NOT EXISTS start_command TEXT;

CREATE TABLE IF NOT EXISTS service_env (
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key        TEXT    NOT NULL,
  value_enc  TEXT    NOT NULL,
  is_secret  BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (service_id, key)
);
