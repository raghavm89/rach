-- Phase 3 BaaS: pay-first compute resize. An UPSIZE parks the target size + the Razorpay
-- order id here while the customer completes the one-time delta payment; /baas/compute/verify
-- clears these and applies the size. Downsizes/same-size apply immediately (no parking).
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baas_pending_resize_order_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS baas_pending_resize_size TEXT;
