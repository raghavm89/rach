# Sprint 2 — Ava (Reception), the second live flow

Status: Done and tested. Reception conversation (typed or dictated) → **structured patient intake + triage summary** → reception/clinician **confirm**, and a one-click **hand-off to Scribe**. Built to match the team's evolved structure (per-org model via `tenantLlm`, registry-driven nav, `LLM_MOCK`, seeded `reception` template).

## What was built

**Backend**
- `packages/core/src/db/migrations/056_encounters.sql` — `encounters` (patient_ref/name, reason, `intake` jsonb, transcript, source, `status` open|confirmed, model, confirmed_by/at).
- `apps/rachdev-backend/src/services/reception.js` — the agent: persona from the seeded `reception` AgentDefinition (Ava) + a strict JSON output contract; resolves model via `getTenantModel` (org setting) → def → default; `mock` support for `LLM_MOCK`. Pure `buildSystemPrompt` / `parseIntake` are unit-tested. Mirrors the Scribe service exactly.
- `apps/rachdev-backend/src/controllers/receptionController.js` + `routes/reception.js` (mounted `/api/reception`):
  - `POST /encounters` — structure an intake into a **draft** (or continue an open one via `encounter_id`).
  - `GET /encounters` · `GET /:id` — list / read.
  - `PATCH /:id` — edit the draft (blocked once confirmed).
  - `POST /:id/confirm` — reception/clinician **confirm** (human-in-the-loop).
  - `DELETE /:id` — remove an open draft.
- `agentMonitorController.js` — Ava now reports **real** encounter stats (runs/confirmed/last-run/model), and encounters appear in the recent-activity feed; enabled-check made robust to the new `status` schema.

**Frontend** (`apps/rachdev-web/src/app/dashboard/clinical/reception/page.tsx`)
- Conversation in two ways: type/paste **and** in-browser dictation (English / Hindi / Punjabi).
- Structure → editable intake (patient name/age/sex, reason, history, meds, allergies, vitals, triage summary).
- **Draft → Confirm** (human-in-the-loop); confirmed intakes become read-only.
- **Start visit note** hands the transcript + triage to **Scribe** (via `sessionStorage`); the Scribe page reads and prefills it — the Ava→Nora hand-off from the architecture.
- Shared `reception` API added to `@rach/ui`. Nav slot already existed in the dashboard registry.

## Verify
- Backend **41/41** node:test (incl. reception prompt/parse + controller + migration).
- `rachdev-web` **0 real type errors**. RachBase **untouched**.

To use it: sign in as `reception` in a Healthcare org → Reception → type/dictate an intake → Structure → review → Confirm → optionally **Start visit note** to carry it into Scribe.

## Next
- Kiran (Inventory): approved-Rx → stock decrement → shortage alert.
- Control Tower live feed; Audit view over notes + encounters.
