'use strict';

/**
 * Dev seed for the status page. Populates data so /status renders with content:
 *   • hourly probes for every component, all operational, from LAUNCH (2026-06-03) → now
 *   • one UPCOMING scheduled maintenance (future — does not affect the green history)
 *
 * Idempotent: probes are only generated for a component that has none yet; the maintenance
 * is keyed by title and skipped if already present. Safe to re-run.
 *
 * Run (after migrations, against your DB):
 *   node apps/rachbase-backend/scripts/seed-status.js
 */

const { pool } = require('@rach/core');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const LAUNCH = Date.UTC(2026, 5, 3, 0, 0, 0); // 2026-06-03 — history is green from here

// Ensure the default components exist (migration 124 seeds these; harmless to repeat).
const COMPONENTS = [
  ['control-plane', 'Control Plane & API', 'Platform', 10, null],
  ['dashboard', 'Dashboard & Website', 'Platform', 20, null],
  ['database', 'Managed Postgres (BaaS)', 'Platform', 30, null],
  ['deploy', 'Deploy Pipeline', 'Platform', 40, null],
  ['region-us-east', 'US East', 'Regions', 60, 'site1'],
];

async function ensureComponents() {
  for (const [key, name, group, sort, siteId] of COMPONENTS) {
    await pool.query(
      `INSERT INTO status_components (key, name, component_group, sort, site_id)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (key) DO NOTHING`,
      [key, name, group, sort, siteId]
    );
  }
  // Drop RachDev LLM if a previous migration/seed created it.
  await pool.query("DELETE FROM status_components WHERE key = 'rachdev'");
}

async function seedProbes() {
  const now = Date.now();
  const { rows: comps } = await pool.query('SELECT key FROM status_components WHERE enabled = TRUE');
  for (const { key } of comps) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM status_probes WHERE component_key = $1', [key]);
    if (rows[0].n > 0) { console.log(`  probes: ${key} already has ${rows[0].n} — skipping`); continue; }

    // Insert in day-sized batches to keep parameter counts sane.
    let inserted = 0;
    for (let dayStart = LAUNCH; dayStart <= now; dayStart += DAY) {
      const values = [];
      const params = [];
      let i = 1;
      for (let t = dayStart; t < dayStart + DAY && t <= now; t += HOUR) {
        const latency = 40 + Math.floor(Math.random() * 120);
        params.push(key, new Date(t).toISOString(), true, false, latency, `${latency}ms`);
        values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
      }
      if (values.length) {
        await pool.query(
          `INSERT INTO status_probes (component_key, ts, ok, degraded, latency_ms, detail) VALUES ${values.join(',')}`,
          params
        );
        inserted += values.length;
      }
    }
    console.log(`  probes: ${key} seeded ${inserted} operational rows (since 2026-06-03)`);
  }
}

async function seedMaintenance() {
  const title = 'Planned Postgres maintenance (US East)';
  const { rows: exists } = await pool.query('SELECT id FROM status_incidents WHERE title = $1', [title]);
  if (exists.length) { console.log('  maintenance: already present — skipping'); return; }

  const start = new Date(Date.now() + 7 * DAY);
  const end = new Date(start.getTime() + 2 * HOUR);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO status_incidents (kind, title, status, impact, started_at, scheduled_end)
       VALUES ('maintenance',$1,'scheduled','maintenance',$2,$3) RETURNING id`,
      [title, start, end]
    );
    const id = rows[0].id;
    for (const key of ['database', 'region-us-east']) {
      await client.query('INSERT INTO status_incident_components (incident_id, component_key) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, key]);
    }
    await client.query(
      'INSERT INTO status_incident_updates (incident_id, status, body, created_at) VALUES ($1,$2,$3,NOW())',
      [id, 'scheduled', 'Postgres in the US East region will undergo a minor-version upgrade. Brief connection interruptions (<1 min) are possible.']
    );
    await client.query('COMMIT');
    console.log('  maintenance: seeded upcoming "Planned Postgres maintenance (US East)"');
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

(async () => {
  try {
    console.log('Seeding status page…');
    await ensureComponents();
    await seedProbes();
    await seedMaintenance();
    console.log('Done. Visit /status to see it.');
  } catch (e) {
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
