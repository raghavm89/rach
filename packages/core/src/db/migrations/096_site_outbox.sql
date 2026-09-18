-- 096_site_outbox.sql
-- BFF side of the SpaceArk site API: durable operations + transactional outbox.
-- The BFF commits product desired-state + the operation + the outbox row in ONE
-- transaction; workers deliver to the site API and never mark delivered until the
-- site acknowledges the same request hash (SpaceArk contract §5.1).

CREATE TABLE IF NOT EXISTS site_operations (
  operation_id   TEXT PRIMARY KEY,                      -- 'op-...' (BFF-generated)
  tenant_id      INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  site_id        TEXT    NOT NULL,
  op_type        TEXT    NOT NULL,                       -- tenant.reconcile | app.upsert | release.create | ...
  resource_type  TEXT    NOT NULL,                       -- tenant | app | release
  resource_id    TEXT    NOT NULL,                       -- SpaceArk ref, e.g. t-...
  generation     INTEGER NOT NULL DEFAULT 1,
  -- ACCEPTED | RECONCILING | SUCCEEDED | FAILED | CANCELLED | BLOCKED
  state          TEXT    NOT NULL DEFAULT 'ACCEPTED',
  reason         TEXT,
  message        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_outbox (
  id               BIGSERIAL PRIMARY KEY,
  operation_id     TEXT NOT NULL REFERENCES site_operations(operation_id) ON DELETE CASCADE,
  site_id          TEXT NOT NULL,
  method           TEXT NOT NULL,
  route            TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL,
  request_hash     TEXT NOT NULL,
  payload          JSONB NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  available_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Fast claim of due, undelivered rows.
CREATE INDEX IF NOT EXISTS idx_site_outbox_claimable ON site_outbox (available_at) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_site_operations_tenant ON site_operations (tenant_id);

-- Reversal (forward-only runner; undo manually if needed):
--   DROP TABLE IF EXISTS site_outbox;
--   DROP TABLE IF EXISTS site_operations;
