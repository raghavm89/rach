# Reception — OPD module (Dhanvantri-style) + fixes

Status: Done and tested. Reworked the Reception workspace to resemble a hospital OPD/registration desk (Dhanvantri), plus the requested reception-role fixes. Note: I **cannot watch video**, so this is built from standard HIS/OPD conventions — refine against Dhanvantri screenshots when available.

## Reception-role fixes
- **Removed** the "Start visit note" button.
- **Doctor Notes** tab (read-only) for reception — view notes authored by doctors (list + SOAP/codes). Reception can view but not author/sign (backend routes enforce: `GET /api/scribe/notes*` now allow `reception`; create/sign stay doctor-only).
- Reception now sees a proper multi-tab workspace (below) instead of only the intake form.

## OPD module

**Data (migration 058)** — HIS-generic, Dhanvantri-syncable:
- `patients` — master record (UHID auto-assigned, demographics). `source_system` + `external_id` so Dhanvantri patients upsert without duplication.
- `visits` — a visit: department, doctor, **token_no** (per-org, per-day serial), `appointment_at` (null = walk-in), `status` (scheduled → waiting → in_consultation → completed / cancelled), optional `encounter_id` link to the AI intake.

**Backend** (`opdController` + `/api/reception/*`, role reception/doctor/admin):
- `GET/POST /patients`, `GET /patients/:id` — **search** (name/UHID/phone) + **register/update**.
- `GET /doctors` — the org's doctors for assignment.
- `POST /visits` — register a visit, **issue a token**; `GET /visits?scope=today` — the **queue**; `PATCH /visits/:id` — advance status.
- `services/dhanvantri.js` — **integration seam** (stub). Not wired in the POC (Dhanvantri has no open API yet); implement the client + set `DHANVANTRI_BASE_URL`/`DHANVANTRI_TOKEN` to sync. Records carry `source_system`/`external_id` for reconciliation.

**Frontend** — Reception tabs:
- **Register** — find patient (search or add) → register a visit (department, doctor, walk-in **or** appointment) → **token issued**.
- **OPD Queue** — today's visits with token, patient, department, doctor, walk-in/appt time, status; actions **Start → Complete / Cancel**.
- **AI Intake** — Ava's structured intake (transcript/dictation → intake → confirm) as an assist, moved into `components/clinical/ReceptionIntake.tsx`.

Shared `opd` API added to `@rach/ui`.

## Verify
- Backend **52/52** node:test (opd endpoints, token/validation guards, dhanvantri seam, migration).
- `rachdev-web` **0 real type errors**. RachBase **untouched**.

## Open (needs your input to match Dhanvantri exactly)
- Exact registration fields / screen layout (share screenshots).
- Dhanvantri API endpoints (to implement the seam).
- Whether appointment slots need a doctor-availability calendar (currently a free datetime).
