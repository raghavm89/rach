-- ── 053_hr_schema.sql ────────────────────────────────────────────────────────
-- HR vertical data layer (moves the HR workspace off demo JSON onto real,
-- tenant-scoped tables). Each row stores the full domain object as JSONB keyed
-- by its business id (ext_id, e.g. REQ-1024) so the API returns exactly the
-- shape the screens already render — the frontend becomes a fetch swap.
--
-- Multi-tenant: every table carries tenant_id and is queried scoped to the
-- caller's tenant (same isolation as agent_definitions etc.).

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_requisitions','hr_applications','hr_candidates',
    'hr_approvals','hr_interviews','hr_offers','hr_audit_events'
  ] LOOP
    EXECUTE format($f$
      CREATE TABLE IF NOT EXISTS %I (
        id         SERIAL PRIMARY KEY,
        tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        ext_id     TEXT    NOT NULL,
        data       JSONB   NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (tenant_id, ext_id)
      );
      CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id);
    $f$, t, 'idx_' || t || '_tenant', t);
  END LOOP;
END $$;
