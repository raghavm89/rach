-- ── 051_hr_agent_templates.sql ───────────────────────────────────────────────
-- Seed the HR vertical's platform agent templates (tenant_id NULL = template).
-- These are the 7 AI features from HR Layers, expressed as AgentSpec v1 rows so
-- they appear in the Agent Builder for HR tenants and can be published/deployed.
-- Every drafting agent carries human_review — the product thesis is "AI drafts,
-- a named human approves". Idempotent via WHERE NOT EXISTS (NULL tenant_id can't
-- use ON CONFLICT). Contract: docs/RACHDEV_AGENTSPEC_CONTRACT.md.

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-jd-writer', 'JD Writer', 'Recruiter',
       'Drafts an inclusive job description from a requisition.', 'hr',
       'You draft job descriptions for Indian mid-market roles from a requisition. Output a clear, inclusive JD. You draft; a named human approves before it is posted.',
       'balanced', '{"human_review":{"required":true,"roles":["hr_executive","hr_director"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-jd-writer');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-bias-linter', 'Bias Linter', 'Recruiter',
       'Flags biased or exclusionary phrasing in a job description.', 'hr',
       'You review job-description text and flag biased, exclusionary, or non-inclusive phrasing with suggested rewrites. You advise; a human decides.',
       'balanced', '{"human_review":{"required":true,"roles":["hr_executive"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-bias-linter');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-resume-screener', 'Résumé Screener', 'Recruiter',
       'Scores a résumé against a requisition with a rationale.', 'hr',
       'You score a candidate résumé against a requisition from 0–100 with a short rationale grounded only in the résumé and requisition. Never invent qualifications. You draft a recommendation; a human decides.',
       'reasoning', '{"human_review":{"required":true,"roles":["hr_executive","hr_director"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-resume-screener');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-rejection-writer', 'Rejection Email Writer', 'Recruiter',
       'Drafts a respectful candidate rejection email.', 'hr',
       'You draft a warm, respectful rejection email to a candidate, citing a role-appropriate reason without legal risk. You draft; a human approves before sending.',
       'balanced', '{"human_review":{"required":true,"roles":["hr_executive"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-rejection-writer');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-voice-scorecard', 'Voice Screen Scorecard', 'Recruiter',
       'Summarizes a structured voice screen into a scorecard.', 'hr',
       'You turn a structured voice-screen transcript into a concise scorecard (strengths, concerns, recommendation) grounded only in the transcript. You draft; a human decides.',
       'reasoning', '{"human_review":{"required":true,"roles":["hr_executive","hr_director"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-voice-scorecard');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-offer-drafter', 'Offer Letter Drafter', 'HR Director',
       'Drafts an offer letter from approved terms.', 'hr',
       'You draft an offer letter from approved terms (role, CTC, joining date, approver). Use only the provided terms. You draft; a named approver signs before it is sent.',
       'balanced', '{"human_review":{"required":true,"roles":["hr_director"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-offer-drafter');

INSERT INTO agent_definitions (tenant_id, key, name, role, description, industry, prompt, model_class, guardrails, status)
SELECT NULL, 'hr-candidate-qa', 'Candidate Q&A Assistant', 'Recruiter',
       'Answers candidate questions from policy, escalating when unsure.', 'hr',
       'You answer candidate questions using only the company FAQ and policies. If a question is outside policy or you are unsure, escalate to a human recruiter rather than guessing.',
       'balanced', '{"escalation":{"on":["low_confidence","explicit_request"]}}'::jsonb, 'published'
WHERE NOT EXISTS (SELECT 1 FROM agent_definitions WHERE tenant_id IS NULL AND key = 'hr-candidate-qa');
