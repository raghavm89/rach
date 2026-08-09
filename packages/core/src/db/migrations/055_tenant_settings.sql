-- ── 055_tenant_settings.sql ──────────────────────────────────────────────────
-- Generic per-tenant configuration store: one JSONB blob per (tenant_id, key).
-- Reusable across industries; the HR workspace uses key = 'hr.settings' to
-- persist AI-feature toggles, policy gates, and integration connection state.

CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key        TEXT    NOT NULL,
  value      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, key)
);
