-- 128_claimed_hosts.sql
-- Cross-tenant subdomain/DNS takeover guard (go-live audit P0 #7).
--
-- Public hostnames under *.rachbase.app were claimed in THREE disjoint places with no shared
-- uniqueness: VM auto-domains (deployment_domains.hostname), shared-container hosts
-- (services.public_host), and BaaS project refs (<ref>.rachbase.app, derived, never stored as a
-- claim) — plus per-service custom_domain, which had no uniqueness at all. Because each namespace
-- only checked itself, a tenant could claim another tenant's container slug (or a project ref) as
-- their VM subdomain; the DNS upsert would then delete the victim's A record and repoint it — a
-- full takeover of a host where user JWTs flow, plus a valid LE cert.
--
-- claimed_hosts is the ONE global authority: every hostname across every namespace is registered
-- here with a single unique key, so a claim in one namespace collides with a claim in any other.
CREATE TABLE IF NOT EXISTS claimed_hosts (
  hostname    TEXT PRIMARY KEY,                 -- lowercased FQDN, globally unique across all namespaces
  tenant_id   INTEGER,                          -- owning tenant (NULL only for legacy backfill rows we couldn't attribute)
  kind        TEXT NOT NULL,                    -- 'vm_domain' | 'container' | 'baas' | 'custom'
  ref         TEXT,                             -- owning resource id (service_id / project_id) as text
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claimed_hosts_tenant ON claimed_hosts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_claimed_hosts_kind_ref ON claimed_hosts (kind, ref);

-- ── Backfill existing claims so current hosts are protected from day one (idempotent) ──────────
-- Container public hosts (tenant via projects).
INSERT INTO claimed_hosts (hostname, tenant_id, kind, ref)
SELECT lower(s.public_host), p.tenant_id, 'container', s.id::text
  FROM services s JOIN projects p ON p.id = s.project_id
 WHERE s.public_host IS NOT NULL AND btrim(s.public_host) <> ''
ON CONFLICT (hostname) DO NOTHING;

-- Per-service custom domains.
INSERT INTO claimed_hosts (hostname, tenant_id, kind, ref)
SELECT lower(s.custom_domain), p.tenant_id, 'custom', s.id::text
  FROM services s JOIN projects p ON p.id = s.project_id
 WHERE s.custom_domain IS NOT NULL AND btrim(s.custom_domain) <> ''
ON CONFLICT (hostname) DO NOTHING;

-- VM auto/custom domains (tenant left NULL — deployment_domains has no direct tenant column; the
-- hostname uniqueness is what protects them, and the runtime claim path attributes new rows).
INSERT INTO claimed_hosts (hostname, tenant_id, kind, ref)
SELECT lower(d.hostname), NULL, CASE WHEN d.is_auto THEN 'vm_domain' ELSE 'custom' END, d.service_id::text
  FROM deployment_domains d
 WHERE d.hostname IS NOT NULL AND btrim(d.hostname) <> ''
ON CONFLICT (hostname) DO NOTHING;

-- BaaS project refs → <ref>.rachbase.app (default domain; runtime uses the real APPS_DOMAIN).
INSERT INTO claimed_hosts (hostname, tenant_id, kind, ref)
SELECT lower(p.ref || '.rachbase.app'), p.tenant_id, 'baas', p.id::text
  FROM projects p
 WHERE p.ref IS NOT NULL AND btrim(p.ref) <> ''
ON CONFLICT (hostname) DO NOTHING;

-- Reversal:
--   DROP TABLE IF EXISTS claimed_hosts;
