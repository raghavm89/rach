-- 030_vm_alerts.sql
-- Persist VM resource-alert cooldown + audit trail (monitoring audit M2).
--
-- Previously alertMonitor tracked cooldown in an in-memory Map, which:
--   * reset on every restart/deploy (alert storms),
--   * was not shared across instances (duplicate emails),
--   * grew unbounded (slow leak).
-- This table replaces it — one row per alert fired, queried for the cooldown
-- window, mirroring how service_alerts (026) already works.

CREATE TABLE IF NOT EXISTS vm_alerts (
  id         SERIAL PRIMARY KEY,
  vm_id      TEXT NOT NULL,                 -- e.g. qemu/101
  metric     TEXT NOT NULL,                 -- cpu | mem | disk
  pct        NUMERIC(5,2),                  -- breaching value at send time
  tenant_id  INTEGER REFERENCES tenants(id) ON DELETE SET NULL,  -- null = admin-only alert
  sent_to    TEXT,                          -- comma-joined recipient emails
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vm_alerts_vm_metric_time
  ON vm_alerts(vm_id, metric, sent_at DESC);
