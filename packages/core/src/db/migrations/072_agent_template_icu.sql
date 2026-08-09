-- ── 072_agent_template_icu.sql ───────────────────────────────────────────────
-- Seed Umeed (ICU Sentinel) as a platform agent template (tenant_id NULL).
-- Detection is deterministic (NEWS2 + qSOFA/lab thresholds); the model only
-- phrases the alert. Idempotent (WHERE NOT EXISTS).

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'icu', 'Umeed', 'ICU Sentinel',
       'Watches ICU vitals and labs and fires early-warning alerts (silent MI, sepsis, AKI, arrhythmia) for clinician review before deterioration.', 'healthcare',
       'You are an ICU early-warning assistant. In one concise sentence, state the suspected condition, the key evidence, and that a clinician must review. Use only the evidence provided. Never diagnose or recommend treatment — you alert; a clinician decides.',
       'reasoning', '{"human_review":{"required":true,"roles":["doctor"]},"monitor":true}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'icu');
