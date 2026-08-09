-- ── 058_opd_reception.sql ────────────────────────────────────────────────────
-- OPD reception (Dhanvantri-style): a patient master + visits (registration,
-- token/queue, appointments). Records carry source_system + external_id so data
-- synced from Dhanvantri reconciles with locally-created records.

CREATE TABLE IF NOT EXISTS patients (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  uhid          TEXT,                              -- our patient id / CR number
  external_id   TEXT,                              -- Dhanvantri patient id
  source_system TEXT    NOT NULL DEFAULT 'local',  -- local | dhanvantri
  name          TEXT    NOT NULL,
  dob           DATE,
  age           TEXT,                              -- free text when DOB unknown
  sex           TEXT,
  phone         TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_tenant_uhid ON patients (tenant_id, uhid) WHERE uhid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_tenant_ext  ON patients (tenant_id, source_system, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patients_tenant_name ON patients (tenant_id, lower(name));

CREATE TABLE IF NOT EXISTS visits (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  encounter_id   INTEGER REFERENCES encounters(id) ON DELETE SET NULL,  -- optional AI intake link
  department     TEXT,
  doctor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  doctor_name    TEXT,
  token_no       INTEGER,
  appointment_at TIMESTAMPTZ,                       -- null = walk-in
  status         TEXT    NOT NULL DEFAULT 'waiting', -- scheduled | waiting | in_consultation | completed | cancelled
  reason         TEXT,
  source_system  TEXT    NOT NULL DEFAULT 'local',
  external_id    TEXT,
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visits_tenant_created ON visits (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits (tenant_id, status);
