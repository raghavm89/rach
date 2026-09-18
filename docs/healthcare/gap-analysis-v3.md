# Gap Analysis — Deck (RachDev_ArmyHospital_v3) vs. Build

_Source: `RachDev_ArmyHospital_v3.pptx` (15 slides). Last updated: 2026-08-08 (rev 3)._

The deck pitches the full vision: **seven specialist agents + a managed cloud backend + native ABDM/ECHS integration**, under a clinician-in-the-loop governance layer. The build now covers **all seven agents with their depth** (not just cores), a real governance layer (Control Tower, append-only audit trail, DPDP consent), and a **config-gated ABDM/ECHS integration seam** running in stub mode (swap-ready for live APIs). The whole loop **Reception → ECHS/ABHA → triage → bed/assignment → Scribe (SOAP + e-prescription + interaction check) → coding/pre-auth → discharge → follow-up** runs with human-in-the-loop gates. What remains is non-agent work: turning the integration seams live, live clinical feeds, and the managed-cloud/analytics layer.

**Legend:** ✅ Built · 🟡 Partial · ⬜ Not started

---

## 1. The seven agents (slide 4)

| Deck agent | Scope in deck | Status | What exists | What's missing |
|---|---|---|---|---|
| **Naina** — Clinical Scribe | Pre-charting, ambient notes, e-prescription, drug-interaction | ✅ | Transcript → SOAP → clinician sign-off; ICD/CPT suggestions; **structured e-prescription**; **deterministic drug-interaction screen** (major/moderate/duplicate, live); EN/HI/PA dictation; note↔visit link; retry + clean errors | Pre-charting before OPD; true real-time ambient capture (dictation exists, not passive listening) |
| **Asha** — Intake & Eligibility | 24/7 multi-channel intake, ABHA linkage, ECHS/TPA eligibility | 🟡 | OPD registration, AFMS patient fields, AI intake → confirmed visit, token slip, DPDP consent, **ABHA linkage + ECHS eligibility (stub seam)** at intake | Multi-channel (WhatsApp/voice/email); **live** ABDM/ECHS APIs (seam is stub-mode today) |
| **Vihaan** — Triage & Safety | Acuity scoring, red-flag detection, ER/OPD routing, on-call paging | ✅ | Acuity (critical→routine, ESI 1–5), red-flag detection, route recommendation (ER/ICU/OPD/specialist), page-on-call flag, clinician acknowledge/override; audited | Real pager/on-call integration (currently a recommendation flag) |
| **Ira** — Knowledge | Grounded, source-cited answers; never diagnoses | ✅ | Answers strictly from a per-hospital approved library, cites sources, refuses when uncovered, hard no-diagnosis rule, library management; audited | Larger corpus / embeddings retrieval (currently keyword); ABDM/reference-source ingestion |
| **Umeed** — ICU Sentinel | Real-time LIS monitoring (silent MI, sepsis, AKI, arrhythmia) | ✅ | NEWS2 + qSOFA/lab detection for sepsis / silent MI / AKI / arrhythmia / deterioration; alert board, acknowledge/resolve; audited | Live LIS/monitor feed (observations are entered manually today) |
| **Kabir** — Coordination | Bed/OT booking, referrals, discharge summaries, follow-up scheduling | ✅ | AI doctor assignment (dept + load), My Patients, visit lifecycle + completion guard, **bed/OT board (assign/release)**, **referrals (create → accept/complete)**, **AI-drafted discharge summaries (clinician-signed)**, **follow-up scheduling**; audited | Live bed feed from HIS; e-referral transmission to external hospitals |
| **Rhea** — Coding & Revenue | ICD-10 coding, charge capture, claim generation, denial-risk | ✅ | Signed note → ICD-10/CPT codes + charge lines + total + denial-risk screen (ECHS/CGHS/TPA); coder edits & submits; **ECHS cashless pre-auth (stub seam)**; audited | Live payer submission (seam is stub-mode), fee-schedule amounts, field-ICD accuracy pass |

**Extra built, not in the deck's seven:** **Kiran — Pharmacy Inventory** (drug stock, movement ledger, reorder alerts). Fold under Pharmacy integration or add an eighth agent line to the deck.

**Scorecard:** 6 agents ✅ built with depth (Naina, Vihaan, Ira, Umeed, Rhea, Kabir) · 1 🟡 Asha (full intake + ABHA/ECHS stub seams; only multi-channel surfaces + live APIs remain). **The agent roster is functionally complete** — remaining work is integration, live feeds, and scale, not agent features.

---

## 2. Platform layers (slides 3 & 10)

| Layer | Deck scope | Status | Notes |
|---|---|---|---|
| **L1 — Integration** | HIS/EMR, LIS, RIS, Pharmacy, ABDM (ABHA/HFR/HPR), ECHS/payers | 🟡 | **Config-gated seams built:** Dhanvantri HIS (`source_system`/`external_id`), **ABDM ABHA linkage**, **ECHS eligibility + cashless pre-auth** — all in stub mode with provenance, swap-ready. No live APIs yet; no live LIS/RIS. |
| **L2 — Orchestration** | 7 agents, shared patient context, handoffs, escalation | 🟡 | All seven agents live; Reception→Scribe hand-off, triage→routing, assignment, completion guard all work. Still no shared event bus / autonomous multi-agent orchestration. |
| **L3 — Governance** | Full audit trail, RBAC, DPDP consent, provenance | ✅ | RBAC ✅, approval gates ✅, **append-only audit trail** (who/what/when/agent/source) with accepted / **modified** / **overridden** decisions ✅, **DPDP consent capture** (purpose, method, provenance) ✅. Remaining: ABDM-native consent artifacts, tamper-proofing. |
| **L4 — Interfaces** | Approval gates, control tower, vernacular voice/chat | 🟡 | **Control Tower is real** (live roster, handoff pipeline, decision feed) ✅; approval gates ✅; EN/HI/PA dictation ✅. Still missing WhatsApp/voice/email conversational surfaces. |

---

## 3. Armed Forces configuration (slide 5)

| Item | Status | Notes |
|---|---|---|
| Military org sub-category + AFMS patient fields (rank, unit, Arms/Corps, ECHS, validity) | ✅ | Org toggle + registration fields live |
| Doctor → department mapping (for correct routing) | ✅ | Set at user creation / editable in Admin → Users; feeds AI assignment |
| DPDP consent at intake | ✅ | Captured at registration; standing consent shown on patient/visit |
| Soldier continuity (posting-proof records via ABHA) | 🟡 | ABHA linkage seam built (stub); real cross-unit record transfer needs live ABDM |
| Field & altitude ICD coding (HAPO/AMS/HACE, frostbite, blast) | 🟡 | Rhea prompts for correct altitude/field codes; needs a validated field code set + accuracy pass |
| ECHS eligibility + cashless pre-auth at intake | 🟡 | Eligibility (intake) + pre-auth (billing) seams built and demoable; needs live ECHS API |
| Fit-for-duty documentation | ⬜ | Naina + discharge exist; needs a dedicated fit-for-duty template |

---

## 4. Managed cloud / BaaS + analytics (slides 8 & 10)

| Item | Status | Notes |
|---|---|---|
| Managed hosting / SLA / India-region | ⬜ | Infra, not app |
| FHIR R4 / HL7 data lake | ⬜ | — |
| Analytics dashboards (bed occupancy, OPD throughput, claim rates, MO workload) | 🟡 | Control Tower + Agent Monitor give live agent/decision analytics; the named clinical/ops dashboards are not built |
| Pre-built connectors (HIS/LIS/RIS/Pharmacy/ECHS/ABDM) | 🟡 | Seams for Dhanvantri HIS, ABDM (ABHA), ECHS (eligibility + pre-auth) exist in stub mode; LIS/RIS/Pharmacy connectors and all live wiring pending |

---

## 5. Naming reconciliation

Done — the healthcare product's display names match the deck: **Naina** (Scribe), **Asha** (Reception/Intake), **Vihaan** (Triage), **Ira** (Knowledge), **Umeed** (ICU Sentinel), plus **Kabir** as the coordination label on assignment/visit actions. **Kiran** (Pharmacy Inventory) kept — not one of the deck's seven. Internal keys unchanged; the unrelated cross-industry demo personas in `lib/industries/*` were left alone.

---

## 6. What's left — recommended sequence

Done since the last revision: **Kabir (coordination depth)** — bed/OT, referrals, discharge summaries, follow-ups — and **Naina depth** — e-prescription + deterministic drug-interaction screening. That closes out all agent-feature work. Remaining blocks, in priority order:

1. **Turn the seams live.** Wire the ABDM sandbox (ABHA/HFR/HPR) and a real ECHS endpoint into the existing `abdm.js` / `echs.js` adapters; likewise Dhanvantri HIS when API access is granted. Interfaces + provenance already exist — this is adapter code + credentials, not new architecture.
2. **Live clinical feeds.** Umeed on a real LIS/monitor stream (replacing manual observation entry); Asha multi-channel intake (WhatsApp/voice/email); Naina passive ambient capture.
3. **Managed-cloud & clinical dashboards.** Hosting/SLA, FHIR R4/HL7 data lake, and the named ops dashboards (bed occupancy, OPD throughput, claim rates, MO workload). Agent Monitor + Control Tower already provide agent/decision analytics to build on.
4. **Revenue hardening (Rhea).** Fee-schedule–backed charge amounts, validated field/altitude ICD set, live payer submission.
5. **AFMS specifics.** Validated field/altitude ICD set, a fit-for-duty documentation template.
6. **Orchestration & governance polish.** Shared event bus for autonomous multi-agent flows; ABDM-native consent artifacts + tamper-proof audit.

**Bottom line:** the agent roster is functionally complete (7/7 with depth), governance is real and demoable, and every external touchpoint has a swap-ready seam. What's left is no longer agent features — it's **making the seams live** (credentials + adapter code), **live clinical feeds**, and the **managed-cloud/analytics layer**: the "connect to the hospital's real systems and scale" half, with the connective tissue already in place.
