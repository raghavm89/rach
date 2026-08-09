'use strict';

/**
 * Kiran — Pharmacy Inventory. Deterministic helpers (no LLM): parse a
 * prescription line into a drug + quantity, compute a reorder suggestion, and
 * format a shortage message. Kept pure so they're easy to unit-test.
 */

/**
 * Best-effort parse of a free-text prescription line against known stock names.
 * e.g. "Metformin 500mg #30", "Amoxicillin x 21", "paracetamol qty 10".
 * @param {string} text
 * @param {string[]} knownDrugs  drug names currently in stock (for matching)
 * @returns {{ drug: string|null, qty: number }}
 */
function parsePrescription(text, knownDrugs = []) {
  const raw = String(text || '').trim();
  if (!raw) return { drug: null, qty: 1 };

  // Quantity: prefer explicit #N / xN / "qty N" / "quantity N"; else a trailing number.
  let qty = 1;
  const q =
    raw.match(/(?:#|x|qty|quantity)\s*(\d{1,4})/i) ||
    raw.match(/\b(\d{1,4})\b\s*(?:tabs?|tablets?|caps?|capsules?|units?)?\s*$/i);
  if (q) qty = Math.max(1, parseInt(q[1], 10));

  // Drug: the longest known stock name that appears in the text (case-insensitive).
  const lower = raw.toLowerCase();
  let drug = null;
  for (const name of knownDrugs) {
    if (name && lower.includes(String(name).toLowerCase())) {
      if (!drug || name.length > drug.length) drug = name;
    }
  }
  // Fallback: first alphabetic token as the drug name.
  if (!drug) {
    const m = raw.match(/[A-Za-z][A-Za-z-]{2,}/);
    drug = m ? m[0] : null;
  }
  return { drug, qty };
}

/** Suggested reorder quantity to bring stock comfortably above the threshold. */
function suggestReorder(quantity, threshold) {
  const t = Math.max(0, Number(threshold) || 0);
  const target = t * 2;
  return Math.max(target - Math.max(0, Number(quantity) || 0), t, 1);
}

function buildAlertMessage({ drug, quantity, unit, threshold, qty_suggested }) {
  const u = unit || 'units';
  return `${drug} is low: ${quantity} ${u} left (reorder at ${threshold}). Suggested reorder: ${qty_suggested} ${u}.`;
}

module.exports = { parsePrescription, suggestReorder, buildAlertMessage };
