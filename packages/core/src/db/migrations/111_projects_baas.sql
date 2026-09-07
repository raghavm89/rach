-- Phase 3 BaaS: turn an existing project into a BaaS project (Auth/Data/Storage/Functions
-- behind <ref>.rachbase.app). Extends the existing projects table (migration 024) rather than
-- adding a new one, so the BaaS project IS the project the tenant already sees.
--   ref            → short public id → <ref>.rachbase.app
--   baas_enabled   → gate + provisioning state
--   jwt_secret_enc → keyCrypto.seal(per-project JWT signing secret); managed-service model,
--                    the control plane holds the ciphertext (tenant-vs-tenant isolation).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS ref            TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baas_enabled   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jwt_secret_enc TEXT;
