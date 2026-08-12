-- ── 082_agent_teams.sql ──────────────────────────────────────────────────────
-- Agent Teams: the multi-agent "canvas" unit. A team is a graph of nodes
-- (channels, a conductor, specialist agents, integrations, human handoff) and
-- edges (routing / tool attachments / handoff), authored on a React-Flow canvas
-- and executed by the orchestration runtime.
--
-- Separate from agent_definitions (single agents): a team's `graph` may
-- reference agent_definitions by id in a specialist node's data, or carry an
-- inline prompt. Tenant-scoped and versioned like agent_definitions; published
-- versions are frozen into agent_team_versions for immutable deploys.

CREATE TABLE IF NOT EXISTS agent_teams (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  description TEXT,
  industry    TEXT,
  -- { "nodes": [ { id, type, position:{x,y}, data:{...} } ],
  --   "edges": [ { id, source, target, label? } ] }
  graph       JSONB   NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  status      TEXT    NOT NULL DEFAULT 'draft',   -- draft | published | deployed | disabled
  version     INTEGER NOT NULL DEFAULT 0,         -- 0 = never published
  published_at TIMESTAMPTZ,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_agent_teams_tenant ON agent_teams (tenant_id);

-- Frozen snapshots of a team's graph at each publish (immutable, for deploys).
CREATE TABLE IF NOT EXISTS agent_team_versions (
  id           SERIAL PRIMARY KEY,
  team_id      INTEGER NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL,
  graph        JSONB   NOT NULL,
  published_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, version)
);
CREATE INDEX IF NOT EXISTS idx_agent_team_versions_team ON agent_team_versions (team_id);
