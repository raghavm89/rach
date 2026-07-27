-- 033_tenant_soft_delete.sql
-- Soft-delete for tenants (admin dashboard audit A1).
--
-- Hard-deleting a tenant cascades away vm_keys (encrypted private keys) and
-- vm_ssh_config, orphaning VMs that ARKA still runs. Soft-delete keeps all rows
-- intact; the delete handler instead revokes keys and emails ARKA to
-- de-provision, so nothing is silently destroyed.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(id) WHERE deleted_at IS NULL;
