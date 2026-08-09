-- ── 076_coordination.sql ─────────────────────────────────────────────────────
-- Kabir (Coordination): the logistics around a visit — bed/OT allocation,
-- referrals, and discharge summaries. Follow-up scheduling reuses `visits`
-- (a scheduled visit), so no separate table is needed. Discharge summaries are
-- AI-drafted and clinician-signed (human-in-the-loop): 'draft' → 'signed'.

CREATE TABLE IF NOT EXISTS beds (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ward        TEXT    NOT NULL,
  bed_number  TEXT    NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'general',   -- general | ICU | OT
  status      TEXT    NOT NULL DEFAULT 'available', -- available | occupied | reserved | maintenance
  patient_id  INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  visit_id    INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, ward, bed_number)
);
CREATE INDEX IF NOT EXISTS idx_beds_tenant ON beds (tenant_id, status);

CREATE TABLE IF NOT EXISTS referrals (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id   INTEGER REFERENCES patients(id) ON DELETE SET NULL,
  visit_id     INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  patient_ref  TEXT,
  from_dept    TEXT,
  to_dept      TEXT,
  to_hospital  TEXT,
  reason       TEXT,
  priority     TEXT    NOT NULL DEFAULT 'routine',  -- routine | urgent
  status       TEXT    NOT NULL DEFAULT 'open',      -- open | accepted | completed | cancelled
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_tenant ON referrals (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS discharge_summaries (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  visit_id     INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  patient_ref  TEXT,
  summary      JSONB   NOT NULL DEFAULT '{}'::jsonb, -- { diagnosis, hospital_course, medications[], follow_up, advice }
  status       TEXT    NOT NULL DEFAULT 'draft',      -- draft | signed
  edited       BOOLEAN NOT NULL DEFAULT FALSE,
  model        TEXT,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  signed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  signed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_discharge_tenant ON discharge_summaries (tenant_id, created_at DESC);
