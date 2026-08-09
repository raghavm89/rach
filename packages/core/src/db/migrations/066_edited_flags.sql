-- ── 066_edited_flags.sql ─────────────────────────────────────────────────────
-- Track whether a clinician edited an AI draft before accepting it, so the audit
-- trail can distinguish "accepted as-is" (signed / confirmed) from "accepted with
-- edits" (modified) — the middle outcome the governance slide promises.

ALTER TABLE clinical_notes ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE encounters     ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
