# RachDev — Demo Runbook (2nd / Final Pitch)

_Structure: **Act 1** runs the AFMS scenario end-to-end through the built agents;
**Act 2** tours the live app surfaces it touched. Hardware is described, not shown.
Timings are a guide for a ~20-minute demo + Q&A._

---

## 0. Before the room (prep checklist)

- Backend + web running; migrations applied (`npm run migrate`), backend restarted.
- Demo tenant set to **Healthcare · Military (AFMS)** (Admin → Organizations → Type).
- Seed users: one **doctor** (with a department, e.g. Pulmonology/ICU), one **reception**, one **org admin**. Log in windows/tabs ready for each role.
- If no live model: set `LLM_MOCK=1` so every agent produces a clean draft offline.
- Ira: add 1–2 approved sources (e.g. an AFMS high-altitude/HAPO protocol snippet) so citations show.
- Optional: pre-create one patient ("Rfn. Arjun Singh") with AFMS fields (rank, unit, ECHS no., validity) so the scan step has data.
- Have the **architecture diagram** and **architecture-workflow doc** open in a tab for the hardware/security questions.

**One-line opener:** "RachDev is an on-prem AI operations layer that sits *on top of* Dhanvantri — it doesn't replace your records, it runs the operation around them, with a doctor approving every clinical action and nothing leaving the hospital."

---

## Act 1 — The scenario (≈8 min): HAPO evacuation from Siachen

> Rfn. Arjun Singh · 24/M · evacuated from 5,400 m · SpO₂ 60% on arrival · ECHS serving personnel · CRITICAL.

Narrate each beat; do the click; name the agent; point to where **hardware** would sit.

1. **Arrival & identity — Reception (Asha).** *"At the desk, reception **scans his encrypted card** — his history, allergies and ECHS/ABHA references load instantly on the local server, even though he's never been to this hospital."* → In-app: open **Reception**, select/register the patient; click **Verify ECHS** (eligible, cashless) and **Link ABHA**. Say: *"No patient data left the building."*

2. **Triage & safety — Vihaan.** Open **Triage**, paste the presentation ("breathless, SpO₂ 60%, confusion, from 5,400 m", vitals). Generate → **CRITICAL**, red flags, route **ICU**, **page on-call**. *"It recommends; the MO decides."* Acknowledge.

3. **Bed & coordination — Kabir.** Open **Coordination → Beds**, assign an **ICU** bed. (Mention referrals/discharge come later in the journey.)

4. **Documentation — Naina (voice).** *"The treating MO wears a **voice pocket device** — ambient audio goes to the on-prem server, never the cloud."* Open **Scribe**; (optionally paste a short exchange or use the prefill from the visit) → **Generate SOAP**; click **Draft Rx** → structured e-prescription; show the **drug-interaction** check flag a risky pair; MO **edits then signs**. Note the **"edited & signed"** shows as *modified* in the audit.

5. **Knowledge — Ira.** Open **Knowledge**, ask *"AFMS protocol for suspected HAPO?"* → source-cited answer from the approved library. Then toggle **web references** to show the **controlled bypass** ("external, unverified, no patient data sent, logged"). Strong security beat.

6. **ICU watch — Umeed.** Open **ICU Sentinel**, record an observation (SpO₂ 60, RR 30, HR 135, lactate high) → sentinel **fires sepsis / deterioration alerts**, NEWS2 high. *"It fires before the bedside team is paged."* Acknowledge. **Say:** *"In production a bedside device gateway streams the monitor and lab readings into this same API automatically — what I just typed, the monitor does every few seconds."* (see architecture-workflow §2a).

7. **Revenue — Rhea.** Open **Billing**, code the signed note → **ICD J70.x + charges + denial-risk LOW**; raise **ECHS cashless pre-auth** → approved reference. *"Correct field-ICD coding means the claim doesn't leak."*

8. **Continuity — discharge (Kabir).** Open **Coordination → Discharge**, draft the discharge summary from the visit's notes, sign it; **schedule a follow-up**. *"On discharge, the card is updated at the scanner — his record travels to his next posting."*

9. **The whole journey — Patient Journey.** Open **Patient Journey**, search the patient (or click **Journey** from any visit). Show the **step-in → step-out timeline** — every agent action and clinician decision in order — and the **"Next steps for the patient"** card (follow-up date, medications, discharge advice). *"This is the patient's whole episode on one screen, and exactly what they walk out with."*

**Close Act 1:** *"One patient, seven agents, one shared context, a clinician in the loop at every clinical step — and the patient leaves knowing exactly what happens next."*

---

## Act 2 — Live app tour (≈6 min)

Show the surfaces quickly to prove it's a real product, not slideware:

- **Control Tower** — the live agent roster (Naina, Asha, Vihaan, Ira, Umeed, Rhea, Kabir + Kiran), the handoff pipeline, and the **recent-decisions feed**.
- **Audit Log** — filter by agent/decision; show **accepted / modified / overridden** and a **consent** entry; hit **Export CSV**. *"This is the governance the deck promises — enforced, not asserted."*
- **My Patients (doctor view)** — the doctor's own queue; open a patient → detail with notes + assigned doctor.
- **Admin** — Organizations (Military toggle, per-org model incl. **on-prem Sarvam**), Users (doctor **departments**), Agent Templates.

**Talking point on models:** *"Same agents run on Claude for the pilot and on on-prem Sarvam in production — a config change, not a rewrite."*

---

## Act 3 — Hardware, on-prem & security (≈3 min, slides + diagram)

Use the **architecture diagram**. Walk the three devices → on-prem AI server → Dhanvantri/EMR, with the **security boundary** drawn:

- **Voice pocket device** (doctor + reception) → on-prem ASR.
- **Encrypted patient card** → portable file across AFMS hospitals.
- **Reception scanner** → read/update card against the local server.
- **On-prem AI servers** (GPU) — air-gapped; only the knowledge bypass has a controlled, logged outbound path that carries **no PHI**.

**Security one-liner:** *"Air-gapped by default, encrypted at rest and on the card, RBAC, human-in-the-loop, and an append-only audit trail — security is the precondition, not a feature."*

---

## Act 4 — Why RachDev vs Dhanvantri (≈2 min)

- *"Dhanvantri stores what happened. RachDev runs the operation around it."*
- Hit the top gaps: **no ambient documentation, no decision support, records don't follow postings, manual ECHS claims, no grounded knowledge assistant, thin AI-audit.**
- Reassure: **no rip-and-replace** — RachDev sits on top; Dhanvantri stays the record.
- (Full gap table is in `architecture-workflow.md` §8.)

---

## Q&A — likely questions & crisp answers

- **"Does data leave the hospital?"** No. On-prem, air-gapped; only the optional knowledge bypass makes an outbound call, and it carries no patient data and is logged.
- **"What if the network/card fails?"** Server is source of truth within the hospital; the card is an offline carrier for cross-hospital continuity. Either can rebuild from the other.
- **"Can the AI prescribe/diagnose on its own?"** No — every clinical action is clinician-approved; the audit shows accept/modify/override.
- **"How is this different from Dhanvantri?"** It's a layer on top, not a replacement — it adds voice documentation, decision support, continuity, coding/claims, knowledge and governance.
- **"Languages?"** Vernacular voice + text (English/Hindi/Punjabi + more Indian languages), structured to one clinical schema.
- **"Deployment?"** 2-week discovery → 60-day single-workflow pilot → expand agent-by-agent; models swap cloud→on-prem by config.

---

## Fallbacks

- Model error / no network → `LLM_MOCK=1` gives clean drafts for every agent.
- Empty screens → run the seed steps in §0.
- Keep the **architecture-workflow doc** open for any hardware/security deep-dive.
