-- Snapshot of the billing jurisdiction + pre-tax line inputs used for a
-- subscription's invoices, captured at activation. Recurring charges are billed
-- only through the `subscription.charged` webhook, which has no access to the
-- original checkout billing form — without this it issued a tax-inclusive
-- single line with no buyer jurisdiction, producing a non-GST-compliant invoice
-- (no IGST breakdown, place of supply "unknown"). The webhook now reissues from
-- this snapshot so every cycle is a proper tax invoice.
--
-- Shape: { currency, lines: [{ description, quantity, unit_price_minor }],
--          billing: { name, email, country, state, gstin, address, ... } }

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_json JSONB;
