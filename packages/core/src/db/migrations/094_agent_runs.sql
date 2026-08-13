-- ── 094_agent_runs.sql ───────────────────────────────────────────────────────
-- Structured run/conversation log. One row per handled message across any
-- channel (widget, whatsapp, slack, api, test). Powers the Conversations inbox
-- and gives the Agent Monitor real per-agent telemetry (runs, credits, last
-- active) instead of parsing the credit ledger's free-text descriptions.

CREATE TABLE IF NOT EXISTS agent_runs (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject_type   TEXT    NOT NULL,                 -- 'agent' | 'team'
  subject_id     INTEGER NOT NULL,
  subject_name   TEXT,
  channel        TEXT    NOT NULL DEFAULT 'api',   -- widget | whatsapp | slack | api | test
  conversation_id TEXT,                            -- groups messages into a thread
  user_message   TEXT,
  reply          TEXT,
  model          TEXT,
  credits_used   INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'ok',     -- ok | error
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_tenant ON agent_runs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_conv   ON agent_runs (tenant_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_subject ON agent_runs (tenant_id, subject_type, subject_id);
