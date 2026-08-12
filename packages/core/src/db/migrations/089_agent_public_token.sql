-- ── 089_agent_public_token.sql ───────────────────────────────────────────────
-- Shared agent runtime: a deployed single agent gets an unguessable public token
-- so it can be reached at /api/public/agent/:token (the single-agent analogue of
-- a team's website widget). Minted on deploy.

ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS public_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_definitions_public_token
  ON agent_definitions (public_token) WHERE public_token IS NOT NULL;
