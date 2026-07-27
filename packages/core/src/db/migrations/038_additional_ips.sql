-- 038: Additional Public IPs (catalog id 'ip') — tracked, entitlement-gated.
--
-- Rachbase does not allocate IPs (Arka does, out-of-band); this records the real
-- IP an admin binds to a VM, gated by the purchased 'ip' quantity. Mirrors the
-- Observability / VM Logs entitlement model. 'released' keeps the audit row while
-- freeing the quota slot.

CREATE TABLE IF NOT EXISTS vm_additional_ips (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vm_id        VARCHAR(100) NOT NULL,                     -- qemu/<n> | lxc/<n>
  ip_address   INET         NOT NULL,
  purpose      TEXT,                                       -- 'egress' | 'mail' | free text
  status       VARCHAR(12)  NOT NULL DEFAULT 'active',     -- active | released
  request_id   INTEGER      REFERENCES vm_expansion_requests(id) ON DELETE SET NULL,
  assigned_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  released_at  TIMESTAMPTZ
);

-- An address belongs to at most one active binding; released rows may repeat.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_ip
  ON vm_additional_ips (ip_address) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_vm_additional_ips_tenant ON vm_additional_ips (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_vm_additional_ips_vm     ON vm_additional_ips (vm_id, status);
