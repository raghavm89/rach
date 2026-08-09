'use strict';

/**
 * Umeed — the ICU Sentinel.
 *
 * Detection is deterministic and clinically grounded (a simplified NEWS2 plus
 * qSOFA / lab thresholds) so it is fast, testable and never hallucinates a vital.
 * The LLM is used only to phrase the human-readable alert message (like Kiran),
 * with a deterministic fallback. The sentinel detects and alerts; a clinician
 * acknowledges and decides — it never orders or treats.
 *
 * Thresholds are decision-support defaults for a POC, NOT a certified early-
 * warning system; a clinician reviews every alert.
 */

const { gateway } = require('@rach/llm');
const { AgentDefinition } = require('@rach/core');
const { getTenantModel } = require('./tenantLlm');

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// ── NEWS2 (simplified) — each parameter contributes 0–3; missing params skipped ─
function news2(o) {
  let s = 0;
  const rr = num(o.rr);
  if (rr != null) s += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
  const spo2 = num(o.spo2);
  if (spo2 != null) s += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
  const sbp = num(o.sbp);
  if (sbp != null) s += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp >= 220 ? 3 : 0;
  const hr = num(o.hr);
  if (hr != null) s += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
  const temp = num(o.temp);
  if (temp != null) s += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
  const gcs = num(o.gcs);
  if (gcs != null && gcs < 15) s += 3; // new confusion / reduced consciousness
  return s;
}

function sev(level) { return level; }

/**
 * Assess one observation. Pure function.
 * @returns {{ news2:number, conditions: Array<{condition,severity,evidence:string[]}> }}
 */
function assess(o) {
  const score = news2(o);
  const conditions = [];
  const hr = num(o.hr), rr = num(o.rr), sbp = num(o.sbp), spo2 = num(o.spo2),
        temp = num(o.temp), gcs = num(o.gcs), creat = num(o.creatinine),
        lact = num(o.lactate), trop = num(o.troponin), urine = num(o.urine_output);
  const ecg = String(o.ecg_note || '').toLowerCase();

  // Sepsis — qSOFA (RR≥22, SBP≤100, GCS<15); infection signals raise severity.
  const qsofa = [rr != null && rr >= 22, sbp != null && sbp <= 100, gcs != null && gcs < 15].filter(Boolean).length;
  const sirsTemp = temp != null && (temp >= 38 || temp <= 36);
  if (qsofa >= 2 || (sirsTemp && hr != null && hr > 90 && rr != null && rr > 20)) {
    const ev = [];
    if (rr != null && rr >= 22) ev.push(`RR ${rr}`);
    if (sbp != null && sbp <= 100) ev.push(`SBP ${sbp}`);
    if (gcs != null && gcs < 15) ev.push(`GCS ${gcs}`);
    if (sirsTemp) ev.push(`Temp ${temp}°C`);
    if (lact != null && lact >= 2) ev.push(`Lactate ${lact}`);
    conditions.push({ condition: 'sepsis', severity: sev((qsofa >= 2 && (lact != null && lact >= 4)) ? 'critical' : 'urgent'), evidence: ev });
  }

  // Silent MI — troponin rise (flagged "silent" when no chest-pain note).
  if (trop != null && trop > 0.04) {
    const ev = [`Troponin ${trop} ng/mL`];
    if (/st|elevation|ischae|ischemia/.test(ecg)) ev.push('ECG: ischaemic changes');
    const silent = !/pain|chest/.test(ecg);
    conditions.push({ condition: 'mi', severity: sev(trop > 0.5 ? 'critical' : 'urgent'), evidence: silent ? [...ev, 'no chest pain noted (silent)'] : ev });
  }

  // AKI — raised creatinine or oliguria.
  if ((creat != null && creat >= 2.0) || (urine != null && urine < 20)) {
    const ev = [];
    if (creat != null && creat >= 2.0) ev.push(`Creatinine ${creat} mg/dL`);
    if (urine != null && urine < 20) ev.push(`Urine ${urine} mL/hr`);
    conditions.push({ condition: 'aki', severity: sev(creat != null && creat >= 3.5 ? 'critical' : 'urgent'), evidence: ev });
  }

  // Arrhythmia — rate extremes or an ECG rhythm note.
  const rhythm = /irregular|af\b|a-?fib|vt\b|v-?tach|svt|brady|tachy|flutter|block/.test(ecg);
  if ((hr != null && (hr >= 130 || hr <= 40)) || rhythm) {
    const ev = [];
    if (hr != null && (hr >= 130 || hr <= 40)) ev.push(`HR ${hr}`);
    if (rhythm) ev.push(`ECG: ${o.ecg_note}`);
    conditions.push({ condition: 'arrhythmia', severity: sev(hr != null && (hr >= 150 || hr <= 35) ? 'critical' : 'urgent'), evidence: ev });
  }

  // Generic deterioration from the aggregate score, if nothing specific fired.
  if (!conditions.length && score >= 5) {
    conditions.push({ condition: 'deterioration', severity: sev(score >= 7 ? 'critical' : 'urgent'), evidence: [`NEWS2 ${score}`] });
  }

  return { news2: score, conditions };
}

// Deterministic one-liner used as the fallback / mock alert message.
function buildMessage(patientName, condition, evidence, score) {
  const label = { sepsis: 'Possible sepsis', mi: 'Possible silent MI', aki: 'Possible AKI', arrhythmia: 'Arrhythmia', deterioration: 'Clinical deterioration' }[condition] || condition;
  return `${label} flagged for ${patientName || 'patient'} — ${evidence.join(', ')}${score ? ` · NEWS2 ${score}` : ''}. Clinician review required.`;
}

/** LLM narration of an alert (best-effort). Falls back to buildMessage on any failure. */
async function narrate({ tenantId, userId, patientName, condition, severity, evidence, score }) {
  const fallback = buildMessage(patientName, condition, evidence, score);
  let def = null;
  try { def = await AgentDefinition.findByKey(tenantId, 'icu'); } catch { /* optional */ }
  const persona = (def?.prompt && String(def.prompt).trim()) ||
    'You are an ICU early-warning assistant. In ONE concise sentence, state the suspected condition, the key evidence, and that a clinician must review. Do not diagnose or recommend treatment. Use only the evidence provided.';
  const model = (await getTenantModel(tenantId)) || def?.model || undefined;
  try {
    const result = await gateway.chat({
      tenantId, userId, model, system: persona,
      messages: [{ role: 'user', content: `Patient: ${patientName || 'unknown'}\nSuspected: ${condition} (${severity})\nNEWS2: ${score}\nEvidence: ${evidence.join('; ')}` }],
      description: 'ICU: narrate alert',
      mock: fallback,
    });
    const text = (result.text || '').trim();
    return { message: text || fallback, model: result.model };
  } catch {
    return { message: fallback, model: null };
  }
}

module.exports = { num, news2, assess, buildMessage, narrate };
