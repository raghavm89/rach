'use strict';

/**
 * BaaS Observability metrics store (Pro). Producers push time-series samples via the internal
 * ingest endpoint; the dashboard reads latest values + bucketed series. Retention is best-effort
 * (old rows pruned on write). Injectable `db` (pool) so it's unit-tested against pglite.
 */

const { pool } = require('@rach/core');

const METRIC_RE = /^[a-z0-9_.]{1,64}$/i;
const RETENTION_DAYS = 7;

// Record a batch of { metric, value, labels?, ts? } samples for a project. Returns the count stored.
async function record(projectId, samples, { db = pool } = {}) {
  const clean = (Array.isArray(samples) ? samples : [])
    .filter((s) => METRIC_RE.test(String(s?.metric || '')) && Number.isFinite(Number(s?.value)))
    .slice(0, 500);
  for (const s of clean) {
    await db.query(
      `INSERT INTO baas_metrics (project_id, metric, value, labels, ts)
       VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, NOW()))`,
      [projectId, s.metric, Number(s.value), JSON.stringify(s.labels || {}), s.ts || null]);
  }
  if (clean.length) {
    await db.query(`DELETE FROM baas_metrics WHERE project_id = $1 AND ts < NOW() - ($2 || ' days')::interval`,
      [projectId, String(RETENTION_DAYS)]).catch(() => {});
  }
  return clean.length;
}

// Latest value per metric (of the given names) for a project.
async function latest(projectId, metrics, { db = pool } = {}) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (metric) metric, value, ts FROM baas_metrics
      WHERE project_id = $1 AND metric = ANY($2) ORDER BY metric, ts DESC, id DESC`,
    [projectId, metrics]);
  return Object.fromEntries(rows.map((r) => [r.metric, { value: Number(r.value), ts: r.ts }]));
}

// Bucketed average series for one metric over the last `minutes`.
async function series(projectId, { metric, minutes = 60, buckets = 30 }, { db = pool } = {}) {
  const bucketSec = Math.max(1, Math.floor((minutes * 60) / buckets));
  const { rows } = await db.query(
    `SELECT to_timestamp(floor(extract(epoch FROM ts) / $4) * $4) AS bucket,
            avg(value) AS value, sum(value) AS total
       FROM baas_metrics
      WHERE project_id = $1 AND metric = $2 AND ts > NOW() - ($3 || ' minutes')::interval
      GROUP BY bucket ORDER BY bucket`,
    [projectId, metric, String(minutes), bucketSec]);
  return rows.map((r) => ({ ts: r.bucket, value: Number(r.value), total: Number(r.total) }));
}

module.exports = { record, latest, series, METRIC_RE };
