-- ── 071_icu.sql ──────────────────────────────────────────────────────────────
-- Umeed (ICU Sentinel): a stream of ICU observations (vitals + key labs) and the
-- early-warning alerts the sentinel fires from them — silent MI, sepsis, AKI,
-- arrhythmia, and NEWS2 deterioration — before the bedside team is paged. The
-- sentinel detects and alerts; a clinician acknowledges and acts. Never treats.

CREATE TABLE IF NOT EXISTS icu_observations (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id    INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_id      INTEGER REFERENCES visits(id) ON DELETE SET NULL,
  recorded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  hr            NUMERIC,   -- heart rate (bpm)
  rr            NUMERIC,   -- respiratory rate (/min)
  sbp           NUMERIC,   -- systolic BP (mmHg)
  dbp           NUMERIC,   -- diastolic BP (mmHg)
  spo2          NUMERIC,   -- oxygen saturation (%)
  temp          NUMERIC,   -- temperature (°C)
  gcs           NUMERIC,   -- Glasgow Coma Scale (3–15)
  creatinine    NUMERIC,   -- serum creatinine (mg/dL)
  lactate       NUMERIC,   -- serum lactate (mmol/L)
  troponin      NUMERIC,   -- troponin (ng/mL)
  wbc           NUMERIC,   -- white cell count (10^9/L)
  urine_output  NUMERIC,   -- urine output (mL/hr)
  ecg_note      TEXT,      -- free-text ECG/rhythm note
  news2         INTEGER,   -- computed NEWS2 aggregate score
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_icu_obs_patient ON icu_observations (tenant_id, patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS icu_alerts (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id      INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  observation_id  INTEGER REFERENCES icu_observations(id) ON DELETE SET NULL,
  condition       TEXT    NOT NULL,                  -- sepsis | aki | mi | arrhythmia | deterioration
  severity        TEXT    NOT NULL DEFAULT 'urgent', -- watch | urgent | critical
  score           INTEGER,                           -- NEWS2 at time of firing
  evidence        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  message         TEXT,
  status          TEXT    NOT NULL DEFAULT 'open',    -- open | acknowledged | resolved
  model           TEXT,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_icu_alerts_status ON icu_alerts (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_icu_alerts_patient ON icu_alerts (tenant_id, patient_id);
