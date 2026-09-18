-- 097_tenant_site_placement.sql
-- Product desired-state for SpaceArk placement: which site a tenant is homed to and
-- its stable SpaceArk tenant ref. Written in the same transaction as the outbox row
-- when a tenant is reconciled to a site (contract §5.1). RachBase-only; harmless in
-- rach_dev_db where the shared migration set also runs.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS site_id         TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS site_tenant_ref TEXT;

-- One SpaceArk ref per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_site_ref
  ON tenants (site_tenant_ref) WHERE site_tenant_ref IS NOT NULL;

-- Reversal:
--   DROP INDEX IF EXISTS uq_tenants_site_ref;
--   ALTER TABLE tenants DROP COLUMN IF EXISTS site_tenant_ref;
--   ALTER TABLE tenants DROP COLUMN IF EXISTS site_id;
