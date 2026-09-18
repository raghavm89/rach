-- 124_status_page.sql
-- Public status page + incident history. Powers https://<web>/status and the 99.95% SLA:
--   * status_components        — the public components shown (control plane, regions, DB, …)
--   * status_probes            — raw prober results (one row per component per tick) → uptime %
--   * status_incidents         — operator-posted incidents / scheduled maintenance
--   * status_incident_updates  — the timeline of updates on an incident
--   * status_incident_components — which components an incident affects (M2M)
-- The prober (services/statusProber.js) writes probes; the public GET /api/status reads all of
-- this (sanitized). Nothing here is tenant-scoped — it is platform-wide, public health.

-- Components shown on the page. `component_group` buckets them (e.g. "Platform", "Regions").
CREATE TABLE IF NOT EXISTS status_components (
  key             TEXT PRIMARY KEY,               -- stable id, e.g. 'control-plane', 'region-in'
  name            TEXT NOT NULL,                  -- display name, e.g. 'India Region (Mumbai)'
  component_group TEXT NOT NULL DEFAULT 'Platform',
  sort            INTEGER NOT NULL DEFAULT 100,
  site_id         TEXT,                           -- if set, prober checks this site's readiness
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per probe tick per component. `ok` false = down; `degraded` true = up but unhealthy
-- (e.g. high latency / partial). Uptime % and the daily history bars are aggregated from here.
CREATE TABLE IF NOT EXISTS status_probes (
  id            BIGSERIAL PRIMARY KEY,
  component_key TEXT NOT NULL REFERENCES status_components(key) ON DELETE CASCADE,
  ts            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ok            BOOLEAN NOT NULL,
  degraded      BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms    INTEGER,
  detail        TEXT
);
CREATE INDEX IF NOT EXISTS idx_status_probes_key_ts ON status_probes (component_key, ts DESC);

-- Operator-posted incidents. `kind` distinguishes an incident from scheduled maintenance.
-- status:  investigating | identified | monitoring | resolved   (incident lifecycle)
--          scheduled | in_progress | completed                  (maintenance lifecycle)
-- impact:  none | minor | major | critical | maintenance
CREATE TABLE IF NOT EXISTS status_incidents (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'incident',   -- 'incident' | 'maintenance'
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'investigating',
  impact      TEXT NOT NULL DEFAULT 'minor',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- for maintenance: the scheduled start
  scheduled_end TIMESTAMPTZ,                       -- maintenance window end (nullable)
  resolved_at TIMESTAMPTZ,
  created_by  INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_incidents_started ON status_incidents (started_at DESC);

CREATE TABLE IF NOT EXISTS status_incident_updates (
  id          BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES status_incidents(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,                       -- the status set by this update
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_status_incident_updates_iid ON status_incident_updates (incident_id, created_at);

CREATE TABLE IF NOT EXISTS status_incident_components (
  incident_id   BIGINT NOT NULL REFERENCES status_incidents(id) ON DELETE CASCADE,
  component_key TEXT NOT NULL REFERENCES status_components(key) ON DELETE CASCADE,
  PRIMARY KEY (incident_id, component_key)
);

-- Seed the default public components (idempotent). `region-in` is tied to the India site so the
-- prober checks its readiness; adjust site_id / add regions as sites are registered.
INSERT INTO status_components (key, name, component_group, sort, site_id) VALUES
  ('control-plane', 'Control Plane & API', 'Platform',  10, NULL),
  ('dashboard',     'Dashboard & Website',  'Platform',  20, NULL),
  ('database',      'Managed Postgres (BaaS)', 'Platform', 30, NULL),
  ('deploy',        'Deploy Pipeline',      'Platform',  40, NULL),
  ('region-us-east', 'US East',             'Regions',  60, 'site1')
ON CONFLICT (key) DO NOTHING;

-- Reversal:
--   DROP TABLE IF EXISTS status_incident_components, status_incident_updates,
--     status_incidents, status_probes, status_components;
