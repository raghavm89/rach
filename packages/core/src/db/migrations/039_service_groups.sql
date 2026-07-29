-- Phase 2 · WS6 — group related deployment services on the canvas.

CREATE TABLE IF NOT EXISTS service_groups (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  color      TEXT    NOT NULL DEFAULT '#477EF7',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_groups_tenant ON service_groups(tenant_id);

-- A service belongs to at most one group; deleting a group unassigns its members.
ALTER TABLE deployment_services
  ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES service_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deployment_services_group ON deployment_services(group_id);
