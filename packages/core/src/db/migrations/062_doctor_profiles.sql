-- ── 062_doctor_profiles.sql ──────────────────────────────────────────────────
-- Healthcare: map doctor users to a department/specialty so the reception queue
-- can auto-assign the best available doctor for a visit's department. Optional —
-- when no profile exists a doctor is treated as an unspecialised, always-eligible
-- candidate. RachDev-only vertical table; the shared users table is untouched.

CREATE TABLE IF NOT EXISTS doctor_profiles (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department  TEXT,
  specialty   TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doctor_profiles_dept ON doctor_profiles (tenant_id, lower(department));
