-- ── 044_agent_definitions.sql ────────────────────────────────────────────────
-- The persisted `AgentSpec`. One row = one agent definition BUILT in the RachDev
-- portal (agent-builder) and OPERATED in a tenant workspace. The @rach/llm
-- gateway resolves `provider`/`model` with no code change, which is what lets the
-- POC run on Claude and production run on-prem (Sarvam via vLLM).
--
-- tenant_id NULL = a platform template; non-NULL = a tenant's configured instance.

CREATE TABLE IF NOT EXISTS agent_definitions (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  key          TEXT    NOT NULL,                 -- 'scribe' | 'reception' | 'inventory' | ...
  name         TEXT    NOT NULL,
  role         TEXT    NOT NULL DEFAULT '',
  tools        JSONB   NOT NULL DEFAULT '[]'::jsonb,
  guardrails   JSONB   NOT NULL DEFAULT '{}'::jsonb,
  provider     TEXT    NOT NULL DEFAULT 'anthropic', -- anthropic | vllm (matches @rach/llm catalog)
  model        TEXT,                                 -- e.g. 'claude-haiku-4-5-20251001' | 'sarvam-105b'
  prompt       TEXT    NOT NULL DEFAULT '',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_definitions_tenant ON agent_definitions(tenant_id);
