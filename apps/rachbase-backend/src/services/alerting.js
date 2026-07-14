'use strict';

/**
 * Sustained-usage alerting (Step 5).
 *
 * Rule: if a service's CPU, memory, OR disk stays at/above THRESHOLD for the whole
 * WINDOW (10 min), email the Tenant Admin once (COOLDOWN dedup) suggesting they add a
 * unit — which they can do live with no downtime. Metrics come from usage samples the
 * orchestrator posts (a Prometheus adapter can replace `samplesSince` later).
 */

const { brevo } = require('@rach/core');
const { ServiceUsage, ServiceAlert, AlertTargets } = require('../models/serviceAlert');

const THRESHOLD = Number(process.env.ALERT_USAGE_THRESHOLD || 90);   // percent
const WINDOW_MIN = Number(process.env.ALERT_WINDOW_MIN || 10);       // sustained minutes
const COOLDOWN_HOURS = Number(process.env.ALERT_COOLDOWN_HOURS || 6);
const KIND = 'usage_90';
const APP_URL = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');

// Decide whether the window is a sustained breach. Breach = we have ~full-window coverage
// AND the *minimum* of some resource across the window is still >= threshold (i.e. it never
// dropped below). Peaks are returned for the email.
function assess(samples, { windowMin = WINDOW_MIN, threshold = THRESHOLD, now = Date.now() } = {}) {
  if (samples.length < 2) return { breaching: false };
  const nums = (k) => samples.map((s) => Number(s[k]));
  const cpu = nums('cpu_pct'), mem = nums('mem_pct'), disk = nums('disk_pct');
  const min = (a) => Math.min(...a), max = (a) => Math.max(...a);

  const oldest = new Date(samples[0].sampled_at).getTime();
  const spanMin = (now - oldest) / 60000;
  const hasCoverage = spanMin >= windowMin - 1; // allow ~1 min slack

  const breachingResources = [];
  if (min(cpu) >= threshold) breachingResources.push('CPU');
  if (min(mem) >= threshold) breachingResources.push('memory');
  if (min(disk) >= threshold) breachingResources.push('disk');

  return {
    breaching: hasCoverage && breachingResources.length > 0,
    hasCoverage,
    resources: breachingResources,
    peak: { cpu: max(cpu), mem: max(mem), disk: max(disk) },
    spanMin,
  };
}

function buildEmail(service, a) {
  const list = a.resources.join(', ');
  const pk = a.peak;
  const url = `${APP_URL}/dashboard/projects`;
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 16px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">
      <tr><td style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:28px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">RachBase — Resource Alert</h1></td></tr>
      <tr><td style="padding:32px;color:#111827;">
        <p style="font-size:16px;margin:0 0 12px;"><strong>${service.name}</strong> has been running at or above ${THRESHOLD}% ${list} usage for over ${WINDOW_MIN} minutes.</p>
        <table cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px;color:#374151;">
          <tr><td style="padding:4px 16px 4px 0;">Peak CPU</td><td><strong>${pk.cpu.toFixed(0)}%</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;">Peak memory</td><td><strong>${pk.mem.toFixed(0)}%</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;">Peak disk</td><td><strong>${pk.disk.toFixed(0)}%</strong></td></tr>
          <tr><td style="padding:4px 16px 4px 0;">Current units</td><td><strong>${service.units}</strong> (0.5 vCPU / 0.5 GB / 0.5 GB each)</td></tr>
        </table>
        <p style="font-size:15px;margin:0 0 20px;">Add a unit (+0.5 vCPU / 0.5 GB / 0.5 GB, $15/mo) to give it more headroom. Scaling is live — no downtime.</p>
        <a href="${url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;font-size:14px;">Add a unit</a>
        <p style="font-size:12px;color:#9ca3af;margin:24px 0 0;">You're receiving this because you're an admin on this RachBase tenant.</p>
      </td></tr>
    </table></td></tr></table></body></html>`;
  return { subject: `⚠️ ${service.name} at ${THRESHOLD}%+ ${list} — consider adding a unit`, html };
}

// Evaluate one service row ({ id, name, units, tenant_id }). Returns a result descriptor.
async function evaluateService(service, opts = {}) {
  const now = opts.now || Date.now();
  const since = new Date(now - WINDOW_MIN * 60000);
  const samples = await ServiceUsage.samplesSince(service.id, since);
  const a = assess(samples, { now });
  if (!a.breaching) return { serviceId: service.id, breaching: false };

  const cooldownSince = new Date(now - COOLDOWN_HOURS * 3600000);
  if (await ServiceAlert.recentExists(service.id, KIND, cooldownSince)) {
    return { serviceId: service.id, breaching: true, skipped: 'cooldown' };
  }

  const recipients = await AlertTargets.adminEmailsForTenant(service.tenant_id);
  if (!recipients.length) return { serviceId: service.id, breaching: true, skipped: 'no_recipients' };

  const { subject, html } = buildEmail(service, a);
  const sent = await brevo.sendAlertEmail({ recipients, subject, htmlContent: html });
  await ServiceAlert.record({
    serviceId: service.id, kind: KIND,
    peakCpu: a.peak.cpu, peakMem: a.peak.mem, peakDisk: a.peak.disk,
    sentTo: recipients.join(','),
  });
  return { serviceId: service.id, breaching: true, emailed: sent, recipients, resources: a.resources };
}

// Sweep every online service — this is the entry point a scheduled task hits (~every minute).
async function evaluateAllOnline(opts = {}) {
  const services = await AlertTargets.onlineServices();
  const results = [];
  for (const s of services) results.push(await evaluateService(s, opts));
  return { evaluated: services.length, alerts: results.filter((r) => r.emailed), results };
}

module.exports = { evaluateService, evaluateAllOnline, assess, THRESHOLD, WINDOW_MIN, COOLDOWN_HOURS };
