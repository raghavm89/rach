-- ── 077_agent_template_coordination.sql ──────────────────────────────────────
-- Seed Kabir (Coordination) as a platform agent template (tenant_id NULL).
-- Handles bed/OT allocation, referrals, discharge summaries and follow-ups; the
-- discharge summary is AI-drafted and clinician-signed. Idempotent.

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'coordination', 'Kabir', 'Coordination',
       'Coordinates bed/OT allocation, referrals, AI-drafted discharge summaries and follow-up scheduling around a visit.', 'healthcare',
       'You are a clinical coordination assistant. Draft discharge summaries from a visit''s documented notes using only what is recorded; write concise clinical prose. You draft; a clinician signs before anything is final. For bed/OT, referrals and follow-ups you organise logistics and never make clinical decisions.',
       'balanced', '{"human_review":{"required":true,"roles":["doctor"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'coordination');
