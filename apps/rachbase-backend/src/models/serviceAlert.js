'use strict';

const { pool } = require('@rach/core');

// Usage samples (0..100 %) pushed by the orchestrator, plus the sustained-breach query.
const ServiceUsage = {
  async record({ serviceId, cpu, mem, disk }) {
    const { rows } = await pool.query(
      `INSERT INTO service_usage_samples (service_id, cpu_pct, mem_pct, disk_pct)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [serviceId, cpu, mem, disk]
    );
    return rows[0];
  },

  // Raw samples in [since, now], oldest first. Min/max/span are computed by the caller
  // so this stays portable (no DB-specific interval / EXTRACT arithmetic).
  async samplesSince(serviceId, since) {
    const { rows } = await pool.query(
      `SELECT cpu_pct, mem_pct, disk_pct, sampled_at
         FROM service_usage_samples
        WHERE service_id = $1 AND sampled_at >= $2
        ORDER BY sampled_at ASC`,
      [serviceId, since]
    );
    return rows;
  },
};

// Fired-alert ledger — cooldown dedup + audit.
const ServiceAlert = {
  async recentExists(serviceId, kind, since) {
    const { rows } = await pool.query(
      `SELECT 1 FROM service_alerts WHERE service_id = $1 AND kind = $2 AND sent_at >= $3 LIMIT 1`,
      [serviceId, kind, since]
    );
    return rows.length > 0;
  },

  async record({ serviceId, kind, peakCpu, peakMem, peakDisk, sentTo }) {
    const { rows } = await pool.query(
      `INSERT INTO service_alerts (service_id, kind, peak_cpu, peak_mem, peak_disk, sent_to)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [serviceId, kind || 'usage_90', peakCpu, peakMem, peakDisk, sentTo || null]
    );
    return rows[0];
  },
};

// Online services + the tenant admins to notify, in one pass.
const AlertTargets = {
  async onlineServices() {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.units, s.status, p.tenant_id
         FROM services s JOIN projects p ON p.id = s.project_id
        WHERE s.status = 'online'`
    );
    return rows;
  },

  // Emails of the tenant's admins (fallback: any user in the tenant).
  async adminEmailsForTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT email FROM users
        WHERE tenant_id = $1 AND role IN ('tenant_admin', 'admin')`,
      [tenantId]
    );
    if (rows.length) return rows.map((r) => r.email);
    const { rows: any } = await pool.query('SELECT email FROM users WHERE tenant_id = $1', [tenantId]);
    return any.map((r) => r.email);
  },
};

module.exports = { ServiceUsage, ServiceAlert, AlertTargets };
