-- ── 085_agent_team_public_token.sql ──────────────────────────────────────────
-- Website widget channel (connectors Phase C). A deployed team can be embedded
-- on a public website. The embed talks to an unauthenticated public endpoint
-- keyed by an unguessable per-team token (minted on deploy). The token maps to
-- the team + tenant so runs are metered against the owning tenant's credits.
--
-- The token is NOT a secret the way an API key is (it ships in page HTML), so
-- the public endpoint is additionally rate-limited and credit-gated. Rotating a
-- team's token simply invalidates old embeds.

ALTER TABLE agent_teams ADD COLUMN IF NOT EXISTS public_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_teams_public_token
  ON agent_teams (public_token) WHERE public_token IS NOT NULL;
