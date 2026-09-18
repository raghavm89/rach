-- 104_plan_tiers.sql
-- New plan lineup (decided 2026-08-21): Starter / Pro / Enterprise; Max is no longer a
-- shown plan (dedicated VMs are plan-independent — bought à la carte). Internally:
--   • 'starter' = the shared tier that USED to be called 'pro' ($15 base, 1 nano incl.).
--   • 'pro'     = the NEW shared tier ($30 base, 3 nano incl.).
--   • 'max'     = the default / unsubscribed sentinel (kept; VMs don't depend on it).
-- So every existing 'pro' tenant is the OLD Pro = the new **Starter** and is renamed here.
--
-- Also record which tier a base subscription funds, so a paused/halted base can be
-- restored to the RIGHT tier on renewal (not blindly to 'pro').
-- RachBase-only; harmless elsewhere.

-- 1) tenants.plan: widen the tier set and migrate old 'pro' → 'starter'.
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_chk;
UPDATE tenants SET plan = 'starter', updated_at = NOW() WHERE plan = 'pro';
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_plan_chk CHECK (plan IN ('starter', 'pro', 'max'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) pro_subscriptions.tier — the tier a BASE subscription funds. Existing base rows were
--    the old Pro = Starter.
ALTER TABLE pro_subscriptions ADD COLUMN IF NOT EXISTS tier TEXT;
UPDATE pro_subscriptions SET tier = 'starter' WHERE kind = 'base' AND tier IS NULL;

-- Reversal:
--   ALTER TABLE pro_subscriptions DROP COLUMN IF EXISTS tier;
--   ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_chk;
--   UPDATE tenants SET plan = 'pro' WHERE plan = 'starter';
--   ALTER TABLE tenants ADD CONSTRAINT tenants_plan_chk CHECK (plan IN ('pro','max'));
