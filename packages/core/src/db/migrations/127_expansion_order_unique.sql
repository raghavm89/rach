-- 127_expansion_order_unique.sql
-- Payment-replay guard (go-live audit P0 #4): one paid Razorpay order must fulfil at most once.
-- The expansion verify handlers used to INSERT a fulfilment row per call with no uniqueness on
-- razorpay_order_id, so a single captured payment could be replayed into multiple provisionings.
-- A partial UNIQUE index (subscription fulfilments carry a NULL order id and are excluded) backs
-- the `ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL DO NOTHING` guard.
--
-- If any duplicate non-null order ids already exist, this index creation will fail — dedupe first
-- (keep the earliest row per order id) before re-running:
--   DELETE FROM vm_expansion_requests a USING vm_expansion_requests b
--    WHERE a.razorpay_order_id = b.razorpay_order_id AND a.id > b.id
--      AND a.razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vm_expansion_requests_order_id
  ON vm_expansion_requests (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

-- Reversal:
--   DROP INDEX IF EXISTS uq_vm_expansion_requests_order_id;
