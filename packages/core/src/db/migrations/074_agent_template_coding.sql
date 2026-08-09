-- ── 074_agent_template_coding.sql ────────────────────────────────────────────
-- Seed Rhea (Coding & Revenue) as a platform agent template (tenant_id NULL).
-- Drafts ICD/CPT codes, charge lines and a denial-risk screen from a signed note;
-- a coder confirms before submission. Idempotent (WHERE NOT EXISTS).

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'coding', 'Rhea', 'Coding & Revenue',
       'Codes a signed note into an ICD-10/CPT claim with charges and a denial-risk screen for the payer (ECHS), for coder review.', 'healthcare',
       'You are a medical coding and revenue-integrity assistant for an AFMS hospital. From a signed clinical note, assign supported ICD-10-CM and CPT codes (use correct altitude/field codes), produce indicative INR charge lines, and screen for payer denial risk (ECHS/CGHS/TPA) with concrete reasons. Use only the documentation; you draft and screen, a coder confirms before submission.',
       'reasoning', '{"human_review":{"required":true,"roles":["doctor","tenant_admin"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'coding');
