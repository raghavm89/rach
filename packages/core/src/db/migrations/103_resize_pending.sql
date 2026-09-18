-- 103_resize_pending.sql
-- Gate compute-size UPSIZES on a completed payment (decided 2026-08-21). Resizing an
-- already-online container to a MORE expensive size now collects a one-time DELTA
-- payment; the new size is applied only after that payment verifies (like bring-online).
-- While the delta checkout is open the container stays online at its OLD size, with the
-- pending upgrade recorded here so verify can tie the payment back to the target size.
--
--   - services.pending_resize_order_id — the one-time Razorpay order awaiting the delta payment.
--   - services.pending_resize_size      — the target compute size to apply once it clears.
--
-- Downsizes and same-size changes need no payment and set neither column.
-- Reversible (see bottom). RachBase-only; harmless elsewhere.

ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_resize_order_id TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_resize_size     TEXT;

-- Reversal:
--   ALTER TABLE services DROP COLUMN IF EXISTS pending_resize_size;
--   ALTER TABLE services DROP COLUMN IF EXISTS pending_resize_order_id;
