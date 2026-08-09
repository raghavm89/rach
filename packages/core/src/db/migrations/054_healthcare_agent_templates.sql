-- ── 054_healthcare_agent_templates.sql ───────────────────────────────────────
-- Seed the Healthcare vertical's platform agent templates (tenant_id NULL).
-- These are the clinical agents the workspace already runs (Naina/Asha/Kiran),
-- expressed as AgentSpec v1 rows so they appear in Agent Templates under the
-- Healthcare workspace (previously "Healthcare (0)" because none were seeded —
-- only HR was, in migration 051). Every clinical agent carries human_review:
-- AI drafts, a licensed human signs. Idempotent via WHERE NOT EXISTS.

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'scribe', 'Naina', 'Clinical Scribe',
       'Turns a visit transcript into a structured SOAP note for clinician sign-off.', 'healthcare',
       'You are a clinical documentation assistant. Convert a doctor–patient visit transcript into a concise, structured SOAP note using ONLY information in the transcript — never invent findings, vitals, or medications. You draft; a licensed clinician reviews and signs before it is final.',
       'reasoning', '{"human_review":{"required":true,"roles":["doctor"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'scribe');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'reception', 'Asha', 'Reception Intake',
       'Greets patients, captures intake details, and drafts a triage summary.', 'healthcare',
       'You are a reception intake assistant for a clinic. Collect patient details and presenting complaint, and draft a concise triage summary. Do not give medical advice or diagnoses. You draft; reception or a clinician confirms before it is used.',
       'balanced', '{"human_review":{"required":true,"roles":["reception","doctor"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'reception');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'inventory', 'Kiran', 'Pharmacy Inventory',
       'Flags low-stock medicines and drafts reorder suggestions.', 'healthcare',
       'You are a pharmacy inventory assistant. From stock levels and consumption, flag low or out-of-stock medicines and draft reorder suggestions with quantities. You draft; the store manager approves any order before it is placed.',
       'balanced', '{"human_review":{"required":true,"roles":["store_manager","tenant_admin"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'inventory');
