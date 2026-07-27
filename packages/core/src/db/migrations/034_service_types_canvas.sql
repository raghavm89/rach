-- 034_service_types_canvas.sql
-- Deployment services gain a source_type (github | postgres) and the canvas gets
-- persisted node positions. A VM can have many services (already supported); a
-- service now renders as its own draggable card wired to its VM.

-- Service type + config. GitHub columns become nullable so a postgres service
-- (no repo) is valid.
ALTER TABLE deployment_services ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'github';
ALTER TABLE deployment_services ADD COLUMN IF NOT EXISTS name        TEXT;
ALTER TABLE deployment_services ADD COLUMN IF NOT EXISTS config      JSONB;
ALTER TABLE deployment_services ALTER COLUMN repo_full_name  DROP NOT NULL;
ALTER TABLE deployment_services ALTER COLUMN branch          DROP NOT NULL;
ALTER TABLE deployment_services ALTER COLUMN installation_id DROP NOT NULL;

-- Canvas node positions, per tenant. node_key is 'vm:<vm_id>' or 'svc:<id>'.
CREATE TABLE IF NOT EXISTS deployment_canvas (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  node_key   TEXT    NOT NULL,
  x          REAL    NOT NULL,
  y          REAL    NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, node_key)
);
CREATE INDEX IF NOT EXISTS idx_deployment_canvas_tenant ON deployment_canvas(tenant_id);
