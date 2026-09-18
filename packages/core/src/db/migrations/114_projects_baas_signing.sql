-- Phase 3 BaaS: per-project ES256 signing keypair for end-user session tokens (asymmetric,
-- Supabase's current model). Auth signs with the sealed private key; the gateway / PostgREST
-- verify with the public key (published as JWKS). The private key never leaves the control
-- plane except into the Auth container's env at deploy time.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sign_priv_enc TEXT;   -- sealed ES256 private key (PEM)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sign_pub TEXT;        -- public key (SPKI PEM) — not secret
ALTER TABLE projects ADD COLUMN IF NOT EXISTS sign_kid TEXT;        -- key id (JWKS `kid`)
