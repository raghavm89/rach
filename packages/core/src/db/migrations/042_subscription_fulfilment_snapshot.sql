-- Cart/fulfilment inputs captured when the subscription is CREATED (before
-- payment), so a VM order can be fulfilled from the `subscription.charged`
-- webhook even if the synchronous activation call never runs (browser closed,
-- network dropped). Holds { tenant_id, requested_by, description, currency,
-- amount_minor, items, vm_count, razorpay_plan_id, subscription_id }.

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS fulfilment_json JSONB;
