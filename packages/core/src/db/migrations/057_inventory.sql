-- ── 057_inventory.sql ────────────────────────────────────────────────────────
-- Kiran (Pharmacy Inventory): drug stock, a ledger of movements, and reorder
-- alerts raised for the store manager when stock crosses its threshold. Mostly
-- deterministic (stock + thresholds); the agent stages a reorder — a human orders.

CREATE TABLE IF NOT EXISTS drug_stock (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug              TEXT    NOT NULL,
  unit              TEXT    DEFAULT 'unit',
  quantity          INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
-- Case-insensitive uniqueness per org so 'Metformin' and 'metformin' are one item.
CREATE UNIQUE INDEX IF NOT EXISTS uq_drug_stock_tenant_drug ON drug_stock (tenant_id, lower(drug));

CREATE TABLE IF NOT EXISTS stock_transactions (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug_stock_id INTEGER REFERENCES drug_stock(id) ON DELETE SET NULL,
  drug          TEXT    NOT NULL,
  delta         INTEGER NOT NULL,                 -- negative = dispensed, positive = restocked
  reason        TEXT    NOT NULL DEFAULT 'dispense', -- dispense | restock | adjust
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stock_tx_tenant ON stock_transactions(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reorder_alerts (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug_stock_id INTEGER REFERENCES drug_stock(id) ON DELETE CASCADE,
  drug          TEXT    NOT NULL,
  quantity      INTEGER NOT NULL,                 -- stock at the moment of the alert
  qty_suggested INTEGER NOT NULL,
  message       TEXT,
  status        TEXT    NOT NULL DEFAULT 'open',   -- open | ordered | dismissed
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reorder_alerts_tenant ON reorder_alerts(tenant_id, status);
