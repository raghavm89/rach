-- ── 080_hr_layers24_schema.sql ──────────────────────────────────────────────
-- HR vertical, Layers 2–4 (Onboard · Operate · Discover) data layer.
-- Extends the Layer-1 pattern from 053_hr_schema.sql: each row stores the full
-- domain object as JSONB keyed by its business id (ext_id), tenant-scoped, so
-- the API returns exactly the shape the screens render.
--
--   employees        — the people directory (MER-0142 …)
--   onboarding       — onboarding plans (checklist, induction kit, invites)
--   probation        — probation checkpoints (day 7/30/60/90)
--   leave_requests   — employee leave applications
--   leave_balances   — per-employee leave entitlement/used (keyed by employeeId)
--   payslips         — payslip metadata (no payroll calculation)
--   letters          — self-service + confirmation letters
--   tickets          — People Ops helpdesk tickets (SLA)
--   review_cycles    — performance review cycles
--   review_evals     — per-employee review evaluations
--   partnerships     — Layer-4 partnership opportunities
--   holidays         — company holiday calendar (keyed by date)
--   announcements    — internal announcements

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'hr_employees','hr_onboarding','hr_probation','hr_leave_requests',
    'hr_leave_balances','hr_payslips','hr_letters','hr_tickets',
    'hr_review_cycles','hr_review_evals','hr_partnerships',
    'hr_holidays','hr_announcements'
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
