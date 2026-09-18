-- 100_container_billing.sql
-- Retire the $15 Service Unit ledger and move to PER-CONTAINER billing (§8, decided
-- 2026-08-21): a service IS the billable container, with a compute size. The Pro base
-- includes 1 app container; each additional is $10/mo; compute size adds a per-container
-- delta (nano +0 / micro +$10 / small +$20). Pay-to-online: pay first, then the
-- container comes online.
--
--   - services.compute_size   — nano | micro | small (default nano).
--   - services.pending_order_id — the Razorpay order awaiting payment (ties checkout↔verify).
--   - DROP service_units       — no more $15 unit ledger.
--
-- Reversible (see bottom). RachBase-only; harmless in rach_dev_db.

ALTER TABLE services ADD COLUMN IF NOT EXISTS compute_size     TEXT NOT NULL DEFAULT 'nano';
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_order_id TEXT;

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_compute_size_chk;
ALTER TABLE services ADD  CONSTRAINT services_compute_size_chk CHECK (compute_size IN ('nano','micro','small'));

DROP TABLE IF EXISTS service_units;

-- Reversal:
--   CREATE TABLE service_units (
--     id SERIAL PRIMARY KEY,
--     service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
--     tenant_id  INTEGER NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
--     status TEXT NOT NULL DEFAULT 'pending',
--     price_cents INTEGER NOT NULL DEFAULT 1500,
--     currency VARCHAR(3) NOT NULL DEFAULT 'USD',
--     razorpay_order_id TEXT, razorpay_payment_id TEXT,
--     created_at TIMESTAMPTZ DEFAULT NOW(), activated_at TIMESTAMPTZ
--   );
--   CREATE INDEX idx_service_units_service ON service_units(service_id);
--   CREATE INDEX idx_service_units_tenant  ON service_units(tenant_id);
--   ALTER TABLE services DROP CONSTRAINT IF EXISTS services_compute_size_chk;
--   ALTER TABLE services DROP COLUMN IF EXISTS pending_order_id;
--   ALTER TABLE services DROP COLUMN IF EXISTS compute_size;
