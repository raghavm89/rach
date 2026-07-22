-- Migration 027: auth hardening
--
-- 1. users.password  → users.password_hash   (the rest of the codebase already
--    assumed the latter; three call sites were writing to a column that did not
--    exist and failing with 42703 at runtime)
-- 2. case-insensitive uniqueness on users.email
-- 3. per-registration OTP attempt counter
-- 4. oauth_identities  — provider links, so OAuth no longer trusts email alone
-- 5. oauth_states      — short-lived CSRF state for the OAuth handshake

-- ── 1. Rename password → password_hash ───────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'password'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'users' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE users RENAME COLUMN password TO password_hash;
  END IF;
END $$;

-- OAuth-only accounts have no password of their own.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;


-- ── 2. Case-insensitive email uniqueness ─────────────────────────────────────
-- Abort loudly rather than silently picking a winner if duplicates already exist.
DO $$
DECLARE dupes TEXT;
BEGIN
  SELECT string_agg(DISTINCT lower(email), ', ')
    INTO dupes
    FROM users
   GROUP BY lower(email)
  HAVING COUNT(*) > 1;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot add case-insensitive email index: duplicate emails differing only by case: %. Merge these accounts first.',
      dupes;
  END IF;
END $$;

-- Normalize existing rows so the app's lower-cased lookups always match.
UPDATE users SET email = lower(email) WHERE email <> lower(email);
UPDATE pending_registrations SET email = lower(email) WHERE email <> lower(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));


-- ── 3. OTP attempt counter ───────────────────────────────────────────────────
-- The IP-keyed rate limiter was the only thing bounding OTP guesses, and its
-- key generator read a field these requests never send. This is the real bound.
ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_pending_reg_created_at
  ON pending_registrations (created_at);


-- ── 4. OAuth provider identities ─────────────────────────────────────────────
-- Previously any IdP account presenting a matching email address inherited the
-- local account. Now the provider + provider_user_id pair is the identity, and
-- linking by email requires a verified email on both sides.
CREATE TABLE IF NOT EXISTS oauth_identities (
  id                SERIAL       PRIMARY KEY,
  user_id           INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          VARCHAR(20)  NOT NULL,
  provider_user_id  VARCHAR(255) NOT NULL,
  email             VARCHAR(255),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities (user_id);


-- ── 5. OAuth CSRF state ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS oauth_states (
  state       VARCHAR(64)  PRIMARY KEY,
  provider    VARCHAR(20)  NOT NULL,
  redirect_to TEXT,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states (expires_at);


-- ── 6. Password reset tokens are now stored as SHA-256 hashes ────────────────
-- Any reset link already in flight is invalidated by this migration, which is
-- the correct outcome — the plaintext values are no longer trusted.
UPDATE users
   SET password_reset_token = NULL,
       password_reset_expires_at = NULL
 WHERE password_reset_token IS NOT NULL;
