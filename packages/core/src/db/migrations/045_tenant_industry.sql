-- ── 045_tenant_industry.sql ──────────────────────────────────────────────────
-- Give a tenant an industry so the app can provision the matching workspace
-- (e.g. industry = 'healthcare' unlocks the clinical workspace in rachdev-web).
-- Nullable; existing tenants stay NULL (no workspace) until set.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry TEXT;
