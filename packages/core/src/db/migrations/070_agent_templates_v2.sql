-- ── 070_agent_templates_v2.sql ───────────────────────────────────────────────
-- Seed the next two Healthcare agents as platform templates (tenant_id NULL):
-- Vihaan (Triage & Safety) and Ira (Knowledge). Same AgentSpec shape as 054, each
-- with human_review so a clinician stays in the loop. Idempotent (WHERE NOT EXISTS).

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'triage', 'Vihaan', 'Triage & Safety',
       'Assesses acuity, detects red flags, and recommends routing (ER/ICU/OPD) for clinician acknowledgement.', 'healthcare',
       'You are a clinical triage assistant. From a patient presentation and vitals, assess acuity, detect red-flag danger signs, and recommend routing. Use only the information provided; never diagnose or decide treatment. You recommend; a clinician acknowledges and decides. When in doubt, escalate acuity rather than under-triage.',
       'reasoning', '{"human_review":{"required":true,"roles":["doctor"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'triage');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'knowledge', 'Ira', 'Knowledge',
       'Answers staff and patient questions strictly from the hospital''s approved sources, always cited, never diagnosing.', 'healthcare',
       'You are a hospital knowledge assistant. Answer only from the approved reference sources provided; if they do not cover the question, say so. Never diagnose, interpret a specific patient''s results, or recommend treatment for an individual — provide general, source-backed information only and cite every source used.',
       'balanced', '{"human_review":{"required":false,"roles":[]},"grounded":true}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'knowledge');
