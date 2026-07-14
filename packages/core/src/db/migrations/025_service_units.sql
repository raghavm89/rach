-- 025_service_units.sql
-- Pay-per-unit ledger + service column additions. Idempotent (024 may already be applied
-- with or without these columns).

ALTER TABLE services ADD COLUMN IF NOT EXISTS units          INTEGER NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN IF NOT EXISTS compute_target TEXT    NOT NULL DEFAULT 'shared';
ALTER TABLE services ADD COLUMN IF NOT EXISTS vm_id          TEXT;

ALTER TABLE services ALTER COLUMN memory_mb SET DEFAULT 512;
ALTER TABLE services ALTER COLUMN disk_gb TYPE NUMERIC(4,2) USING disk_gb::numeric;
ALTER TABLE services ALTER COLUMN disk_gb SET DEFAULT 0.5;

-- One row per purchased Service Unit (0.5 vCPU / 0.5 GB / 0.5 GB @ $15/mo).
-- The service's active-unit count = number of 'active' rows here.
CREATE TABLE IF NOT EXISTS service_units (
  id                  SERIAL PRIMARY KEY,
  service_id          INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending',   -- pending | active | cancelled
  price_cents         INTEGER NOT NULL DEFAULT 1500,     -- $15
  currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  activated_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_service_units_service ON service_units(service_id);
CREATE INDEX IF NOT EXISTS idx_service_units_tenant  ON service_units(tenant_id);
