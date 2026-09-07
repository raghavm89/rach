-- 122_services_public_host.sql
-- Per-app public ingress needs a GLOBALLY-UNIQUE public host so two tenants can't both route
-- the same `<slug>.rachbase.app` (cross-tenant hijack). Claim it once and pin it here; the
-- unique index is the enforcement (the claim retries with a suffix on conflict).
ALTER TABLE services ADD COLUMN IF NOT EXISTS public_host TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_services_public_host ON services (public_host) WHERE public_host IS NOT NULL;

-- Reversal:
--   DROP INDEX IF EXISTS uq_services_public_host;
--   ALTER TABLE services DROP COLUMN IF EXISTS public_host;
