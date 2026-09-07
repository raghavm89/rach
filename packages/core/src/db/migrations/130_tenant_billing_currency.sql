-- 130_tenant_billing_currency.sql
-- Lock each tenant's billing currency at first subscription instead of re-deriving it from
-- the (editable) billing address on every checkout. Re-derivation meant a mid-life address
-- edit could mix an INR base with USD containers, and a RoW customer could self-declare an
-- India address for ~48%-cheaper container pricing on later checkouts (go-live audit M1).
-- NULL = not locked yet (no paid subscription); the first successful base activation sets it.
--
-- Non-destructive: adds one nullable column.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_currency VARCHAR(3);

-- Backfill tenants that already have a live pro subscription with the currency it bills in,
-- so existing subscribers are locked to what they actually pay today.
UPDATE tenants t
   SET billing_currency = ps.currency
  FROM (
    SELECT DISTINCT ON (tenant_id) tenant_id, currency
      FROM pro_subscriptions
     WHERE status <> 'cancelled'
     ORDER BY tenant_id, id ASC
  ) ps
 WHERE ps.tenant_id = t.id AND t.billing_currency IS NULL;

-- Reversal:
--   ALTER TABLE tenants DROP COLUMN IF EXISTS billing_currency;
