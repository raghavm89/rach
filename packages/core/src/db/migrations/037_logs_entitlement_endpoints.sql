-- 037: VM Logs entitlement + Application Workload Monitoring (endpoints)
--
-- VM Logs is sold per-VM and gated exactly like VM Resource Observability:
-- a tenant buys N 'logs' slots, an admin assigns them to specific VMs, and log
-- access is allowed only on assigned VMs.
--
-- Application Workload Monitoring is sold per-endpoint: a tenant may create up to
-- the purchased number of monitored HTTP endpoints; a background prober checks
-- each on its interval and alerts on failure.

-- ── VM Logs assignment (mirrors vm_observability_assignments) ─────────────────
CREATE TABLE IF NOT EXISTS vm_logs_assignments (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vm_id       VARCHAR(100) NOT NULL,
  assigned_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  assigned_by INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, vm_id)
);

-- ── Monitored HTTP endpoints (Application Workload Monitoring) ─────────────────
CREATE TABLE IF NOT EXISTS monitored_endpoints (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id           INTEGER      REFERENCES deployment_services(id) ON DELETE SET NULL,
  name                 TEXT         NOT NULL,
  url                  TEXT         NOT NULL,
  method               VARCHAR(10)  NOT NULL DEFAULT 'GET',
  expected_status      INTEGER      NOT NULL DEFAULT 200,
  interval_seconds     INTEGER      NOT NULL DEFAULT 300,
  enabled              BOOLEAN      NOT NULL DEFAULT TRUE,
  last_status          VARCHAR(10),                 -- 'up' | 'down' | NULL (unknown)
  last_code            INTEGER,
  last_latency_ms      INTEGER,
  last_checked_at      TIMESTAMPTZ,
  last_error           TEXT,
  consecutive_failures INTEGER      NOT NULL DEFAULT 0,
  last_alerted_at      TIMESTAMPTZ,
  created_by           INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_monitored_endpoints_tenant ON monitored_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_monitored_endpoints_due    ON monitored_endpoints(enabled, last_checked_at);

-- ── Check history (bounded; the prober prunes old rows) ───────────────────────
CREATE TABLE IF NOT EXISTS endpoint_checks (
  id          SERIAL PRIMARY KEY,
  endpoint_id INTEGER      NOT NULL REFERENCES monitored_endpoints(id) ON DELETE CASCADE,
  checked_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ok          BOOLEAN      NOT NULL,
  status_code INTEGER,
  latency_ms  INTEGER,
  error       TEXT
);
CREATE INDEX IF NOT EXISTS idx_endpoint_checks_endpoint ON endpoint_checks(endpoint_id, checked_at DESC);
