-- ── 082_tenant_plan.sql ──────────────────────────────────────────────────────
-- RachBase Pro/Max tier on tenants (shared-pool Pro tier — Phase 1).
--   • plan = 'max'  → dedicated infrastructure (the existing product). This is the
--                      DEFAULT, so every existing tenant is mapped to 'max' with no
--                      data change and the Max path is completely unaffected.
--   • plan = 'pro'  → shared-pool, scale-to-zero tier (new; invisible behind a flag).
--
-- NOTE: this `tenants.plan` (a tenant TIER) is DISTINCT from the `plans` table, which
-- holds Razorpay subscription plans. There is no SQL conflict — a column on `tenants`
-- and the `plans` table are unrelated objects. Convention: `tenants.plan` = tier,
-- `plans`/`Plan` = Razorpay billing plan. See docs/PRO_TIER_shared_pool_mapping.md.
--
-- RachBase-only. The shared migration set also runs against rach_dev_db, where this
-- column is harmless and unused (same pattern as 045_tenant_industry).
--
-- Reversal (the runner is forward-only; undo manually if ever needed):
--   ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_plan_chk;
--   DROP INDEX IF EXISTS idx_tenants_plan;
--   ALTER TABLE tenants DROP COLUMN IF EXISTS plan;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'max';

-- Constrain to known tiers (guarded so re-runs are idempotent).
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_plan_chk CHECK (plan IN ('pro', 'max'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Pro tenants are the minority; index only the non-default rows for fast lookup.
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan) WHERE plan <> 'max';
