# Sprint 2 — Nora (Scribe), the first real agent

Status: Done and tested. Flagship POC flow: **transcript → structured SOAP note + suggested codes → clinician review & sign-off**, running on Claude via `@rach/llm`. All in RachDev + shared packages; RachBase untouched.

## What was built

**Backend**
- `packages/core/src/db/migrations/046_clinical_notes.sql` — `clinical_notes` (transcript, `soap` jsonb, `codes` jsonb, `follow_ups`, `status` draft|signed, `signed_by`/`signed_at`, `model`).
- `apps/rachdev-backend/src/services/scribe.js` — the agent: builds the SOAP system prompt, calls `gateway.chat` (Claude now; on-prem Sarvam later — the gateway resolves the model, no code change), and safely parses the model's JSON (`buildSystemPrompt`, `parseNote` are pure + unit-tested). Uses the tenant's `scribe` **AgentDefinition** (prompt/model) if configured, else defaults.
- `apps/rachdev-backend/src/controllers/scribeController.js` + `routes/scribe.js` (mounted `/api/scribe`):
  - `POST /api/scribe/notes` — generate a SOAP **draft** from a transcript.
  - `GET /api/scribe/notes` · `GET /notes/:id` — list / read.
  - `PATCH /notes/:id` — clinician edits the draft (blocked once signed).
  - `POST /notes/:id/sign` — **sign-off** (doctor/admin only; the human-in-the-loop gate).

**Frontend** (`apps/rachdev-web/src/app/dashboard/clinical/scribe/page.tsx`)
- Transcript in **two ways** (as requested): type/paste, **and** in-browser **dictation** via the Web Speech API with an English / Hindi / Punjabi selector.
- Generate → editable SOAP note (S/O/A/P) + suggested CPT/ICD codes + follow-ups.
- **Draft** badge until the clinician clicks **Approve & Sign** → **Signed** badge with timestamp; signed notes become read-only. Nothing is final until signed.
- Shared API methods added to `@rach/ui` (`scribe.create/list/get/update/sign`, additive — RachBase unaffected).

## Transcript input — POC vs production

- **Now:** browser dictation (Web Speech API) turns speech → text entirely client-side, so audio never hits a server and no ASR service is needed for the demo. Typed/pasted transcripts also work.
- **Production (on-prem):** speech is transcribed by **IndicWhisper** (Hindi/Punjabi) on the hospital's own hardware, then the same `/api/scribe/notes` flow runs. The `source` field already distinguishes `text` | `dictation` | `asr`, and the note pipeline is identical — only the transcription front-end changes.

## Human-in-the-loop & audit

The agent only ever produces a **draft**; `sign` is a separate, role-gated action. Every note carries `author_id`, `model`, `signed_by`, `signed_at` and status transitions — the raw material for the Audit view (Sprint 3).

## Verify

```bash
cd apps/rachdev-backend && npm test        # 26 tests
npm run migrate -w @rach/core              # applies 046 (needs Postgres)
cd apps/rachdev-web && npx next build
```

To use it: set the tenant to Healthcare (Settings), sign in as a `doctor`, open **Scribe**, paste or dictate a visit, Generate, review, **Approve & Sign**.

## Verification results
- Backend: **26/26** node:test pass (incl. Scribe prompt/parse helpers, controller, migration).
- `rachdev-web`: **0 real type errors**. RachBase: **untouched**.

## Next (Sprint 2/3)
- Wire `ControlTower` `source='live'` to show Nora's real status.
- Ava (Reception intake) → opens an encounter that feeds Scribe.
- Kiran (Inventory) on approved prescriptions; Audit view over `clinical_notes` + actions.
