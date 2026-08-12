'use strict';

const pool = require('../config/db');

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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO knowledge_docs (tenant_id, title, body, citation, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [tenantId, title, body, citation, userId]
      );
      const doc = rows[0];
      const chunks = chunkText(body);
      for (let i = 0; i < chunks.length; i++) {
        await client.query(
          'INSERT INTO knowledge_chunks (tenant_id, doc_id, ordinal, text) VALUES ($1,$2,$3,$4)',
          [tenantId, doc.id, i, chunks[i]]
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

  async listDocs(tenantId) {
    const { rows } = await pool.query(
      `SELECT d.id, d.title, d.citation, d.created_at, d.updated_at,
              COUNT(c.id)::int AS chunk_count, LENGTH(d.body) AS char_len
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
