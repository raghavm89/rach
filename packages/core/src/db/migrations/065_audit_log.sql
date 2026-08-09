-- ── 065_audit_log.sql ────────────────────────────────────────────────────────
-- Governance: an append-only audit trail of every agent action and the clinician
-- decision on it (created / confirmed / signed / assigned / completed / cancelled
-- / flagged). Each row records who, what, when, the agent, the patient reference,
-- the source (typed / dictated / AI / manual) and the model — the record the deck
-- promises for DPDP / ABDM / AFMS. Append-only by convention (no UPDATE/DELETE in
-- app code); rows cascade only when the tenant itself is removed.

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- the human who acted
  agent       TEXT,            -- display name: Naina | Asha | Kabir | Kiran (null = human-only)
  action      TEXT NOT NULL,   -- short label, e.g. 'SOAP note signed'
  decision    TEXT,            -- created | confirmed | signed | assigned | completed | cancelled | flagged | overridden | modified
  entity_type TEXT,            -- note | encounter | visit | alert
  entity_id   INTEGER,
  patient_ref TEXT,
  source      TEXT,            -- text | dictation | ai | manual
  model       TEXT,
  summary     TEXT,
  metadata    JSONB   NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_time     ON audit_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_agent    ON audit_log (tenant_id, agent);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_decision ON audit_log (tenant_id, decision);
