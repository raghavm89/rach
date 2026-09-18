-- 101_pro_subscriptions.sql
-- Recurring Pro billing (base + add-on model, decided 2026-08-21). One BASE
-- subscription per tenant (Pro plan + the included app container, its compute folded
-- into the amount) and one CONTAINER subscription per ADDITIONAL container. Each maps
-- to a real monthly Razorpay subscription. Replaces the one-time pay-to-online order.
--
-- The base row's service_id = the service currently occupying the included allowance;
-- resizing/deleting it repoints/reprices via subscriptions.update (no new checkout).
-- RachBase-only; harmless in rach_dev_db.

CREATE TABLE IF NOT EXISTS pro_subscriptions (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id)  ON DELETE CASCADE,
  service_id        INTEGER          REFERENCES services(id) ON DELETE SET NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('base','container')),
  razorpay_sub_id   TEXT,
  razorpay_plan_id  TEXT,
  amount_cents      INTEGER NOT NULL,
  currency          VARCHAR(3) NOT NULL DEFAULT 'USD',
  compute_size      TEXT NOT NULL DEFAULT 'nano',
  status            TEXT NOT NULL DEFAULT 'created',  -- created | active | cancelled
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pro_subs_tenant  ON pro_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pro_subs_service ON pro_subscriptions(service_id);
-- At most one live base subscription per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_subs_base
  ON pro_subscriptions(tenant_id) WHERE kind = 'base' AND status <> 'cancelled';
-- At most one live subscription per service.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pro_subs_service_live
  ON pro_subscriptions(service_id) WHERE service_id IS NOT NULL AND status <> 'cancelled';

-- Reversal:
--   DROP TABLE IF EXISTS pro_subscriptions;
