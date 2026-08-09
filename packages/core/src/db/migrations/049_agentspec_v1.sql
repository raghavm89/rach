-- ── 049_agentspec_v1.sql ─────────────────────────────────────────────────────
-- Promote agent_definitions to the formal AgentSpec v1 contract.
-- Spec: docs/RACHDEV_AGENTSPEC_CONTRACT.md
--
-- Decisions locked (§10): draft + immutable published versions; model_policy.class
-- (not raw provider/model); strict validation; Template stays a separate catalog;
-- four tool types. This migration is ADDITIVE and normalizes existing rows so the
-- strict validator is safe to switch on afterwards ("normalize then enforce").
--
-- The legacy `provider`/`model` columns are kept (not dropped) for one release:
--   • `model_class` is the new source of truth for model selection
--   • `model` is repurposed as the optional pin (a concrete catalog model id)
--   • `provider` is left in place, unused by the spec path

-- ── New columns on the working draft row ─────────────────────────────────────
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS spec_version    TEXT    NOT NULL DEFAULT '1.0';
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS template_slug   TEXT;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS template_version INTEGER;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS industry        TEXT;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS description     TEXT    NOT NULL DEFAULT '';
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS model_class     TEXT    NOT NULL DEFAULT 'balanced';
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS channels        JSONB   NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS knowledge       JSONB;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS runtime_target  JSONB   NOT NULL DEFAULT '{"type":"rachbase"}'::jsonb;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS status          TEXT    NOT NULL DEFAULT 'draft';
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS version         INTEGER NOT NULL DEFAULT 1;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;
ALTER TABLE agent_definitions ADD COLUMN IF NOT EXISTS created_by      INTEGER;

-- Constrain the closed sets (idempotent add).
DO $$ BEGIN
  ALTER TABLE agent_definitions
    ADD CONSTRAINT agent_definitions_status_chk
    CHECK (status IN ('draft', 'published', 'deployed', 'disabled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE agent_definitions
    ADD CONSTRAINT agent_definitions_model_class_chk
    CHECK (model_class IN ('fast', 'balanced', 'reasoning'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Normalize existing free-form rows to a valid v1 shape ────────────────────
-- Lifecycle: an enabled row was effectively live → 'published'; disabled → 'disabled'.
UPDATE agent_definitions
   SET status = CASE WHEN enabled THEN 'published' ELSE 'disabled' END
 WHERE status = 'draft';

-- Carry a concrete legacy model into the pin column; otherwise leave pin NULL so
-- model_class ('balanced') drives resolution.
UPDATE agent_definitions
   SET model = NULLIF(model, '')
 WHERE model IS NOT NULL;

-- Ensure JSONB shape invariants (tools = array, guardrails/channels/runtime_target = object/array).
UPDATE agent_definitions SET tools      = '[]'::jsonb                    WHERE jsonb_typeof(tools)      IS DISTINCT FROM 'array';
UPDATE agent_definitions SET guardrails = '{}'::jsonb                    WHERE jsonb_typeof(guardrails) IS DISTINCT FROM 'object';
UPDATE agent_definitions SET channels   = '[]'::jsonb                    WHERE jsonb_typeof(channels)   IS DISTINCT FROM 'array';
UPDATE agent_definitions SET runtime_target = '{"type":"rachbase"}'::jsonb WHERE jsonb_typeof(runtime_target) IS DISTINCT FROM 'object';

-- ── Immutable published snapshots ────────────────────────────────────────────
-- One row per publish. A deployment references a specific (tenant_id, agent_key,
-- version); editing the draft and re-publishing produces version+1, leaving
-- already-deployed versions untouched.
CREATE TABLE IF NOT EXISTS agent_spec_versions (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  agent_key    TEXT    NOT NULL,
  version      INTEGER NOT NULL,
  spec         JSONB   NOT NULL,          -- the full, validated AgentSpec at publish time
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_by   INTEGER,
  UNIQUE (tenant_id, agent_key, version)
);

CREATE INDEX IF NOT EXISTS idx_agent_spec_versions_key
  ON agent_spec_versions (tenant_id, agent_key);
