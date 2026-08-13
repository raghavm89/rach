-- ── 093_agent_evals.sql ──────────────────────────────────────────────────────
-- Per-agent test cases ("evals"). Each is an input message + an expectation the
-- agent's reply must satisfy. Running them scores pass/fail → a readiness % shown
-- before Ship-it, so bad agents don't get deployed. Last result is cached on the
-- row so readiness is instant without a re-run.

CREATE TABLE IF NOT EXISTS agent_evals (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_id     INTEGER NOT NULL REFERENCES agent_definitions(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL DEFAULT 'Test case',
  input        TEXT    NOT NULL,
  expect_type  TEXT    NOT NULL DEFAULT 'contains',  -- contains | not_contains | regex
  expect_value TEXT    NOT NULL,
  last_status  TEXT,                                 -- pass | fail | NULL (never run)
  last_output  TEXT,
  last_run_at  TIMESTAMPTZ,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_evals_agent ON agent_evals (agent_id);
