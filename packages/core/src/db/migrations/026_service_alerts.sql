-- 026_service_alerts.sql
-- Step 5: sustained-usage alerting. The orchestrator posts per-service usage samples;
-- the evaluator emails the Tenant Admin when any resource stays >=90% for a full window.

-- Raw usage samples (percent 0..100) pushed by the orchestrator / metrics agent.
CREATE TABLE IF NOT EXISTS service_usage_samples (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  cpu_pct     NUMERIC(5,2) NOT NULL,
  mem_pct     NUMERIC(5,2) NOT NULL,
  disk_pct    NUMERIC(5,2) NOT NULL,
  sampled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usage_samples_service_time
  ON service_usage_samples(service_id, sampled_at DESC);

-- One row per alert fired — dedup (cooldown) + audit trail.
CREATE TABLE IF NOT EXISTS service_alerts (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'usage_90',   -- usage_90 | ...
  peak_cpu    NUMERIC(5,2),
  peak_mem    NUMERIC(5,2),
  peak_disk   NUMERIC(5,2),
  sent_to     TEXT,                                -- comma-joined recipient emails
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_alerts_service_time
  ON service_alerts(service_id, kind, sent_at DESC);
