-- ── 091_tenant_kind.sql ──────────────────────────────────────────────────────
-- Distinguish a self-serve personal workspace from an enterprise org. A personal
-- workspace is one self-signed-up user who owns it (labeled "Member"); an org is
-- provisioned by the RachDev platform admin, has an industry, and can hold many
-- members (owner labeled "Org Admin"). Industry/vertical modules are org-only.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'personal';

-- Best-effort backfill for existing tenants (leaves their data untouched):
--  • any tenant with an industry set was created as an org
--  • any tenant with more than one member is an org
UPDATE tenants SET kind = 'org' WHERE industry IS NOT NULL AND kind <> 'org';
UPDATE tenants t SET kind = 'org'
 WHERE kind <> 'org'
   AND (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) > 1;
