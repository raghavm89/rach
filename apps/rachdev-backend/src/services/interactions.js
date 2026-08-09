'use strict';

/**
 * Drug-interaction checker — DETERMINISTIC on purpose.
 *
 * Interaction screening is safety-critical, so it runs on an explicit, testable
 * rule set rather than a model. Each rule matches two drug patterns (order-
 * agnostic) and yields a severity + explanation. Also flags duplicate orders of
 * the same drug. This is a POC decision-support set, NOT a complete interaction
 * database — a clinician reviews every warning. Extend `RULES` as needed; a live
 * deployment can swap this for a licensed interaction API behind the same shape.
 */

// Common drug/class matchers (lowercased substrings / regexes).
const M = {
  warfarin: /warfarin|acitrom|acenocoumarol/,
  nsaid: /ibuprofen|naproxen|diclofenac|aspirin|ketorolac|nsaid|aceclofenac/,
  aspirin: /aspirin|asa\b|ecosprin/,
  aceArb: /pril\b|sartan\b|enalapril|ramipril|lisinopril|losartan|telmisartan/,
  potassium: /potassium|k-?cl|spironolactone|eplerenone/,
  statin: /statin|atorvastatin|simvastatin|rosuvastatin/,
  macrolide: /clarithromycin|erythromycin/,
  ssri: /fluoxetine|sertraline|paroxetine|citalopram|escitalopram|ssri/,
  serotonergic: /tramadol|sumatriptan|triptan|linezolid|ondansetron/,
  metformin: /metformin/,
  benzo: /diazepam|lorazepam|alprazolam|clonazepam|benzodiazepine/,
  opioid: /morphine|tramadol|fentanyl|codeine|oxycodone/,
};

// [matcherA, matcherB, severity, description]
const RULES = [
  [M.warfarin, M.nsaid, 'major', 'Warfarin + NSAID/aspirin: markedly increased bleeding risk.'],
  [M.warfarin, M.macrolide, 'major', 'Warfarin + macrolide: raised INR / bleeding risk.'],
  [M.statin, M.macrolide, 'major', 'Statin + clarithromycin/erythromycin: rhabdomyolysis risk.'],
  [M.aceArb, M.potassium, 'moderate', 'ACE inhibitor/ARB + potassium or spironolactone: hyperkalaemia risk.'],
  [M.ssri, M.serotonergic, 'moderate', 'SSRI + serotonergic agent (tramadol/triptan/linezolid): serotonin-syndrome risk.'],
  [M.benzo, M.opioid, 'major', 'Benzodiazepine + opioid: additive respiratory depression / sedation.'],
];

function norm(drug) { return String(drug || '').toLowerCase().trim(); }

/**
 * Screen a medication list for interactions and duplicates.
 * @param {Array<{drug:string}>} meds
 * @returns {Array<{severity:'major'|'moderate'|'minor', drugs:string[], description:string}>}
 */
function checkInteractions(meds) {
  const list = (Array.isArray(meds) ? meds : []).map((m) => ({ raw: (m && m.drug) || '', n: norm(m && m.drug) })).filter((m) => m.n);
  const warnings = [];

  // Pairwise rule matches (order-agnostic), each unordered pair reported once.
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      for (const [ra, rb, severity, description] of RULES) {
        const hit = (ra.test(a.n) && rb.test(b.n)) || (ra.test(b.n) && rb.test(a.n));
        if (hit) { warnings.push({ severity, drugs: [a.raw, b.raw], description }); break; }
      }
    }
  }

  // Duplicate therapy — same drug ordered more than once.
  const seen = new Map();
  for (const m of list) seen.set(m.n, (seen.get(m.n) || 0) + 1);
  for (const [n, count] of seen) {
    if (count > 1) {
      const raw = list.find((m) => m.n === n).raw;
      warnings.push({ severity: 'moderate', drugs: [raw, raw], description: `Duplicate order: "${raw}" appears ${count} times.` });
    }
  }

  const rank = { major: 0, moderate: 1, minor: 2 };
  return warnings.sort((x, y) => rank[x.severity] - rank[y.severity]);
}

module.exports = { checkInteractions, RULES };
