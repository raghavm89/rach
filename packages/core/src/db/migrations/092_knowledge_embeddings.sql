-- ── 092_knowledge_embeddings.sql ─────────────────────────────────────────────
-- Semantic retrieval for the knowledge base. Each chunk gets an embedding vector
-- (stored as a JSON array — no pgvector dependency, so it works on any Postgres).
-- Retrieval ranks by cosine similarity in-app when embeddings exist, and falls
-- back to the existing full-text search when they don't.

ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding jsonb;
