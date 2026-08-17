'use strict';

/**
 * Default Agent-Team templates, keyed by industry.
 *
 * Every workspace should have an editable Agent Team that represents its AI flow
 * — the same graph the canvas, Control Tower, and runtime all speak. When an org
 * has no team yet, we seed the one that matches its industry (or a generic
 * starter) so "the flow" is always a real, editable team rather than something
 * hardcoded per screen. Node/edge shape matches the React-Flow canvas
 * (TeamEditor): nodes = { id, type, position, data }, edges = { id, source, target }.
 */

const g = (nodes, edges) => ({ nodes, edges });
const edge = (s, t) => ({ id: `e-${s}-${t}`, source: s, target: t });

// Healthcare — mirrors the Control Tower handoff pipeline (Asha intake → Naina
// scribe → Kabir coordination, Kiran pharmacy alongside) + doctor handoff.
const HEALTHCARE = g(
  [
    { id: 'ch', type: 'channel', position: { x: 40, y: 80 }, data: { channel: 'website', label: 'Website widget' } },
    { id: 'c', type: 'conductor', position: { x: 300, y: 80 }, data: { label: 'Asha — Intake', role: 'Greets patients, understands the need, and routes to the right specialist', rules: [
      // Deterministic routing (checked top-to-bottom, first match wins; else the model routes).
      { when: 'emergency, ICU, OT, operation, surgery, admit, admission, bed, transfer', to: 's2' }, // → Kabir (Coordination)
      { when: 'prescription, medicine, medication, dispense, pharmacy, drug, refill, dosage', to: 's3' }, // → Kiran (Pharmacy)
      { when: 'note, document, documentation, SOAP, summary, scribe, visit', to: 's1' }, // → Naina (Scribe)
    ] } },
    { id: 's1', type: 'specialist', position: { x: 600, y: -40 }, data: { label: 'Naina — Clinical Scribe', role: 'Documents visits into SOAP notes', prompt: 'You are Naina, a clinical scribe. Turn the consultation into a clear, structured SOAP note.', model_class: 'balanced' } },
    { id: 's2', type: 'specialist', position: { x: 600, y: 80 }, data: { label: 'Kabir — Coordination', role: 'Beds, referrals, discharge & follow-ups', prompt: 'You are Kabir, a care coordinator. Handle bed allocation, referrals, discharge summaries and follow-ups.', model_class: 'balanced' } },
    { id: 's3', type: 'specialist', position: { x: 600, y: 200 }, data: { label: 'Kiran — Pharmacy', role: 'Dispensing & stock shortage alerts', prompt: 'You are Kiran, pharmacy inventory. Handle dispensing and raise reorder alerts when stock is low.', model_class: 'balanced' } },
    { id: 'h', type: 'handoff', position: { x: 300, y: 260 }, data: { label: 'Doctor (human handoff)' } },
  ],
  [edge('ch', 'c'), edge('c', 's1'), edge('c', 's2'), edge('c', 's3'), edge('c', 'h')],
);

// HR — mirrors the HR AI features (screening, onboarding, policy/leave) + human handoff.
const HR = g(
  [
    { id: 'ch', type: 'channel', position: { x: 40, y: 80 }, data: { channel: 'website', label: 'Website widget' } },
    { id: 'c', type: 'conductor', position: { x: 300, y: 80 }, data: { label: 'HR Assistant', role: 'Understands employee & candidate requests and routes them', rules: [] } },
    { id: 's1', type: 'specialist', position: { x: 600, y: -40 }, data: { label: 'Recruiter — Screening', role: 'Screens applications against the requisition', prompt: 'You are a recruiting assistant. Screen applications against the requisition and summarize fit. Never make a final hiring decision — a human approves.', model_class: 'balanced' } },
    { id: 's2', type: 'specialist', position: { x: 600, y: 80 }, data: { label: 'Onboarding Buddy', role: 'Guides new joiners through setup', prompt: 'You are an onboarding assistant. Guide new hires through joining tasks and answer setup questions.', model_class: 'balanced' } },
    { id: 's3', type: 'specialist', position: { x: 600, y: 200 }, data: { label: 'Policy & Leave Assistant', role: 'Answers HR policy & leave queries', prompt: 'You are an HR helpdesk assistant. Answer policy and leave questions from the knowledge base; escalate exceptions to a human.', model_class: 'balanced' } },
    { id: 'h', type: 'handoff', position: { x: 300, y: 260 }, data: { label: 'HR executive (human handoff)' } },
  ],
  [edge('ch', 'c'), edge('c', 's1'), edge('c', 's2'), edge('c', 's3'), edge('c', 'h')],
);

// Generic starter — for a workspace with no (or an unrecognized) industry.
const GENERIC = g(
  [
    { id: 'ch', type: 'channel', position: { x: 40, y: 80 }, data: { channel: 'website', label: 'Website widget' } },
    { id: 'c', type: 'conductor', position: { x: 300, y: 80 }, data: { label: 'Assistant', role: 'Understands and routes every message', rules: [] } },
    { id: 's1', type: 'specialist', position: { x: 600, y: 40 }, data: { label: 'Specialist', role: '', prompt: 'You are a helpful specialist. Answer clearly and concisely.', model_class: 'balanced' } },
    { id: 'h', type: 'handoff', position: { x: 300, y: 240 }, data: { label: 'Human handoff' } },
  ],
  [edge('ch', 'c'), edge('c', 's1'), edge('c', 'h')],
);

const TEMPLATES = {
  healthcare: { key: 'care-team', name: 'Care Team', description: 'Starter agent team for your clinic — edit the flow on the canvas.', graph: HEALTHCARE },
  hr:         { key: 'people-team', name: 'People Team', description: 'Starter HR agent team — edit the flow on the canvas.', graph: HR },
};

/** The default team spec for an industry (or the generic starter). */
function defaultTeamFor(industry) {
  const t = industry && TEMPLATES[industry];
  return t || { key: 'my-first-team', name: 'My First Team', description: 'Starter agent team — edit the flow on the canvas.', graph: GENERIC };
}

module.exports = { defaultTeamFor, TEMPLATES };
