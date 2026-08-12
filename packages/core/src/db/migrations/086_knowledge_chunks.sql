-- ── 086_knowledge_chunks.sql ─────────────────────────────────────────────────
-- Knowledge base retrieval (agent connectors). A knowledge_doc's body is split
-- into retrievable chunks so an agent's knowledge tool returns focused, cited
-- passages rather than whole documents. Ranking uses Postgres full-text search
-- (a generated tsvector + GIN index) — good enough without an external embedding
-- provider, and embeddings-ready: add an `embedding vector` column + swap the
-- ORDER BY later without changing the agent tool contract.

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id         SERIAL PRIMARY KEY,
  tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  doc_id     INTEGER NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  ordinal    INTEGER NOT NULL DEFAULT 0,
  text       TEXT    NOT NULL,
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tenant ON knowledge_chunks (tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc    ON knowledge_chunks (doc_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv    ON knowledge_chunks USING GIN (tsv);
