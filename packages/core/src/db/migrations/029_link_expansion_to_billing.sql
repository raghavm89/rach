-- Migration 029: link fulfilment records to the billing core
--
-- Rachbase had two parallel billing implementations:
--
--   /api/payments   plans → subscriptions → orders → payments   (normalized;
--                   owns the only webhook; unused by the web app)
--   /api/expansion  vm_expansion_requests                       (one table with
--                   items_json and four bolted-on ALTERs; what the UI uses)
--
-- The consequence was not merely duplication. The webhook resolves
-- subscriptions through the `subscriptions` table, so an expansion subscription
-- was invisible to it:
--
--   * renewal charges recorded nothing — no order, no payment, no invoice
--     for cycle 2 onward;
--   * a failed or Razorpay-side-cancelled subscription still read 'active'
--     in Rachbase indefinitely;
--   * next_charge_at was never written by anything.
--
-- After this migration, expansion purchases write real subscriptions/orders/
-- payments rows and vm_expansion_requests becomes what its name suggests: the
-- FULFILMENT record (admin provisioning workflow), pointing at the billing rows.
--
-- Scope: NEW PURCHASES ONLY. Existing rows are intentionally left unlinked —
-- see the note at the bottom.

ALTER TABLE vm_expansion_requests
  ADD COLUMN IF NOT EXISTS subscription_id INT REFERENCES subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_id        INT REFERENCES orders(id)        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expansion_requests_subscription
  ON vm_expansion_requests (subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expansion_requests_order
  ON vm_expansion_requests (order_id)
  WHERE order_id IS NOT NULL;

-- The webhook fans out from a Razorpay subscription id to the fulfilment rows
-- that reference it, so that lookup needs to be indexed too.
CREATE INDEX IF NOT EXISTS idx_expansion_requests_rzp_sub
  ON vm_expansion_requests (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;


-- ── Unlinked legacy rows ─────────────────────────────────────────────────────
-- Existing vm_expansion_requests keep subscription_id IS NULL. They will not
-- receive webhook-driven status updates or renewal invoices, because there is
-- no corresponding `subscriptions` row and creating one retroactively would
-- fabricate a billing history we cannot verify against Razorpay.
--
-- To find rows that may need attention (an active subscription that predates
-- this migration and is therefore still silently un-renewed):
--
--   SELECT id, tenant_id, razorpay_subscription_id, subscription_status, requested_at
--     FROM vm_expansion_requests
--    WHERE razorpay_subscription_id IS NOT NULL
--      AND subscription_id IS NULL
--      AND subscription_status IN ('active', 'cancel_at_period_end')
--    ORDER BY requested_at;
--
-- Each can be adopted into the billing core by creating a `plans` +
-- `subscriptions` row from the live Razorpay subscription and setting
-- subscription_id here. Do that only after reconciling against Razorpay —
-- the paid_count and current period must come from them, not from us.

COMMENT ON COLUMN vm_expansion_requests.subscription_id IS
  'FK to subscriptions. NULL for rows created before migration 029; those do not receive webhook updates.';
COMMENT ON COLUMN vm_expansion_requests.order_id IS
  'FK to the order for the initial charge. Renewal orders link via subscriptions.';
