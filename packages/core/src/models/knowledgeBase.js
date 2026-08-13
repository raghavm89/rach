'use strict';

const pool = require('../config/db');
const embeddings = require('../services/embeddings');

/**
 * KnowledgeBase — a tenant's uploaded reference docs + retrievable chunks
 * (migrations 069 + 086). Adding a doc splits its body into chunks; the agent
 * knowledge tool searches those chunks (Postgres full-text) and answers grounded
 * in the top passages, with citations. Reuses knowledge_docs so a tenant's
 * library is shared across surfaces.
 */

const MAX_CHUNK = 900; // ~chars; small enough to be focused, big enough to keep context

/** Split text into chunks on paragraph/sentence boundaries, packed to ~MAX_CHUNK. */
function chunkText(body) {
  const paras = String(body || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  let buf = '';
  const push = () => { if (buf.trim()) out.push(buf.trim()); buf = ''; };
  for (const para of paras) {
    if (para.length > MAX_CHUNK) {
      push();
      // hard-split an oversized paragraph on sentence ends
      const sentences = para.match(/[^.!?]+[.!?]+|\S+$/g) || [para];
      for (const s of sentences) {
        if ((buf + ' ' + s).length > MAX_CHUNK) push();
        buf = buf ? `${buf} ${s}`.trim() : s.trim();
        if (buf.length >= MAX_CHUNK) push();
      }
      push();
    } else if ((buf + '\n\n' + para).length > MAX_CHUNK) {
      push(); buf = para;
    } else {
      buf = buf ? `${buf}\n\n${para}` : para;
    }
  }
  push();
  return out.length ? out : [String(body || '').trim()].filter(Boolean);
}

const KnowledgeBase = {
  chunkText,

  /** Add a doc + its chunks in one transaction. Returns the doc with chunk count. */
  async addDoc(tenantId, { title, body, citation = null, userId = null }) {
    const chunks = chunkText(body);
    // Best-effort embeddings (semantic search); null when disabled/failed → keyword.
    let vecs = null;
    try { vecs = await embeddings.embed(chunks); } catch { vecs = null; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO knowledge_docs (tenant_id, title, body, citation, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tenantId, title, body, citation, userId]
      );
      const doc = rows[0];
      for (let i = 0; i < chunks.length; i++) {
        const emb = vecs && vecs[i] ? JSON.stringify(vecs[i]) : null;
        await client.query(
          'INSERT INTO knowledge_chunks (tenant_id, doc_id, ordinal, text, embedding) VALUES ($1,$2,$3,$4,$5::jsonb)',
          [tenantId, doc.id, i, chunks[i], emb]
        );
      }
      await client.query('COMMIT');
      return { ...doc, chunk_count: chunks.length };
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally {
      client.release();
    }
  },

  /** Embed any chunks that don't have an embedding yet (after enabling a key). */
  async reindex(tenantId) {
    const { rows } = await pool.query(
      'SELECT id, text FROM knowledge_chunks WHERE tenant_id = $1 AND embedding IS NULL',
      [tenantId]
    );
    if (!rows.length) return { embedded: 0, pending: 0 };
    let vecs = null;
    try { vecs = await embeddings.embed(rows.map((r) => r.text)); } catch { vecs = null; }
    if (!vecs) return { embedded: 0, pending: rows.length }; // embeddings disabled
    let n = 0;
    for (let i = 0; i < rows.length; i++) {
      if (!vecs[i]) continue;
      await pool.query('UPDATE knowledge_chunks SET embedding = $2::jsonb WHERE id = $1', [rows[i].id, JSON.stringify(vecs[i])]);
      n++;
    }
    return { embedded: n, pending: rows.length - n };
  },

  async listDocs(tenantId) {
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.citation, d.created_at, d.updated_at,
              COUNT(c.id)::int AS chunk_count,
              COUNT(c.embedding)::int AS embedded_count,
              LENGTH(d.body) AS char_len
         FROM knowledge_docs d
         LEFT JOIN knowledge_chunks c ON c.doc_id = d.id
        WHERE d.tenant_id = $1
        GROUP BY d.id
        ORDER BY d.updated_at DESC`,
      [tenantId]
    );
    return rows;
  },

  /** Delete a doc (chunks cascade). Tenant-scoped. Returns true if removed. */
  async deleteDoc(tenantId, docId) {
    const { rowCount } = await pool.query(
      'DELETE FROM knowledge_docs WHERE id = $1 AND tenant_id = $2',
      [docId, tenantId]
    );
    return rowCount > 0;
  },

  /**
   * Rank chunks for a query. Full-text (ts_rank) first; if the query is all
   * stopwords or matches nothing, fall back to ILIKE on the longest terms.
   * Returns [{ doc_id, title, citation, text, rank }].
   */
  async search(tenantId, query, limit = 4) {
    const q = String(query || '').trim();
    if (!q) return [];

    // 1) Semantic: embed the query and rank the tenant's embedded chunks by cosine.
    try {
      const qv = await embeddings.embed([q]);
      if (qv && qv[0]) {
        const { rows } = await pool.query(
          `SELECT c.doc_id, d.title, d.citation, c.text, c.embedding
             FROM knowledge_chunks c JOIN knowledge_docs d ON d.id = c.doc_id
            WHERE c.tenant_id = $1 AND c.embedding IS NOT NULL
            LIMIT 2000`,
          [tenantId]
        );
        if (rows.length) {
          const scored = rows
            .map((r) => ({ doc_id: r.doc_id, title: r.title, citation: r.citation, text: r.text, rank: embeddings.cosine(qv[0], r.embedding) }))
            .sort((a, b) => b.rank - a.rank)
            .slice(0, limit);
          return scored;
        }
      }
    } catch { /* embeddings unavailable → fall back to keyword */ }

    // 2) Fallback: Postgres full-text.
    const ft = await pool.query(
      `SELECT c.doc_id, d.title, d.citation, c.text,
              ts_rank(c.tsv, plainto_tsquery('english', $2)) AS rank
         FROM knowledge_chunks c
         JOIN knowledge_docs d ON d.id = c.doc_id
        WHERE c.tenant_id = $1
          AND c.tsv @@ plainto_tsquery('english', $2)
        ORDER BY rank DESC
        LIMIT $3`,
      [tenantId, q, limit]
    );
    if (ft.rows.length) return ft.rows;

    // Fallback: keyword ILIKE on the longest content words.
    const terms = (q.toLowerCase().match(/[a-z0-9]{3,}/g) || []).sort((a, b) => b.length - a.length).slice(0, 4);
    if (!terms.length) return [];
    const likes = terms.map((_, i) => `c.text ILIKE $${i + 2}`).join(' OR ');
    const { rows } = await pool.query(
      `SELECT c.doc_id, d.title, d.citation, c.text, 0 AS rank
         FROM knowledge_chunks c
         JOIN knowledge_docs d ON d.id = c.doc_id
        WHERE c.tenant_id = $1 AND (${likes})
        LIMIT $${terms.length + 2}`,
      [tenantId, ...terms.map((t) => `%${t}%`), limit]
    );
    return rows;
  },
};

module.exports = KnowledgeBase;
