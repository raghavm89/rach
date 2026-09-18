-- Phase 3 BaaS: Observability metrics (Pro plan). Time-series samples pushed by producers —
-- the per-project gateway (request counts, latency, bytes) and the site controller (host CPU /
-- memory / disk IO / network) — via the internal ingest endpoint. Read back as latest values +
-- bucketed series for the Observability dashboard.

CREATE TABLE IF NOT EXISTS baas_metrics (
  id         BIGSERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  metric     TEXT NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  labels     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS baas_metrics_pmt ON baas_metrics (project_id, metric, ts DESC);
