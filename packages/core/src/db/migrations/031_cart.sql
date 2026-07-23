-- 031_cart.sql
-- Persistent per-user billing cart. Stored server-side so the cart follows a
-- user across devices/sessions: log in from another machine, open the cart, and
-- the billing page restores the same picked items + order summary.
--
-- One row per user. items_json is an array of { id, qty } where id is a catalog
-- service id (validated server-side against the pricing catalog on write).

CREATE TABLE IF NOT EXISTS carts (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
