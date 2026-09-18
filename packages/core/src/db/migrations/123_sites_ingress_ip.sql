-- 123_sites_ingress_ip.sql
-- The public ingress IP is PER SITE (each site/cluster has its own edge), so store it on the
-- site row next to api_url — not a single global env. Auto-DNS resolves the tenant's site and
-- points `<sub>.rachbase.app` at that site's ingress IP. (Env SITE_INGRESS_IP remains a fallback
-- default for a single-site setup.)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS ingress_ip TEXT;

-- Reversal:
--   ALTER TABLE sites DROP COLUMN IF EXISTS ingress_ip;
