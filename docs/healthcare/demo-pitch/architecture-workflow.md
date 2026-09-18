# RachDev — Architecture, Workflow & Hardware (Pitch Reference)

_Companion to the 2nd/final pitch. Covers the on-prem architecture, the hardware
workflow (voice device, encrypted patient card, reception scanner), the security
model, multi-hospital continuity, the knowledge internet-bypass, multi-language
support, hardware requirements, and how RachDev compares to Dhanvantri._

> **Positioning in one line:** RachDev is an **on-prem AI operations + interoperability layer that runs on top of the hospital's existing system of record (Dhanvantri)** — it does not rip-and-replace. Dhanvantri keeps the records; RachDev adds the agents, the continuity, and the automation, with a clinician approving every clinical action.

---

## 1. End-to-end workflow (with hardware)

```
Patient arrives ─▶ Reception
   │  (1) Reception SCANS the patient's encrypted smart card
   │      → local server decrypts + loads history (or registers new)
   │  (2) ECHS eligibility + ABHA verified at the desk (Asha)
   │
   ▼
Triage (Vihaan) ── acuity + red flags + routing (ER/ICU/OPD)
   │
   ▼
Consultation ─ doctor wears a VOICE POCKET DEVICE
   │  (3) Ambient audio → on-prem ASR → Naina drafts SOAP + e-prescription
   │      → drug-interaction screen → doctor reviews & signs
   │
   ├─▶ Ira (knowledge)  — source-cited answers; optional web-reference bypass
   ├─▶ Umeed (ICU)      — live vitals/labs → early-warning alerts
   ├─▶ Kabir            — bed/OT, referrals, discharge summary, follow-up
   └─▶ Rhea             — ICD/CPT coding, ECHS claim + cashless pre-auth
   │
   ▼
Discharge ─ (4) card UPDATED at reception scanner with the new episode
            → patient carries their record to the next unit/posting
```

Every step writes to the **append-only audit trail** (who/what/when/agent/source, and whether the clinician accepted, modified or overrode the AI).

---

## 2. Hardware (not in the demo — described in the workflow)

Hardware is **out of scope for the software demo** but is part of the deployed workflow and is called out on the relevant slides.

**(a) Voice pocket device — doctor & reception.** A small, hospital-issued recorder/mic (belt- or lanyard-worn) that streams audio to the on-prem server over the hospital LAN/Wi-Fi. It is the capture front-end for Naina (consultation) and Asha (reception intake). No audio leaves the premises; ASR runs on-prem. Push-to-talk + auto-mute between patients; paired to the clinician's identity so the transcript is attributed and access-controlled.

**(b) Encrypted patient smart card.** Each patient carries a card holding an **encrypted** copy of their key record (identity, allergies, chronic conditions, current meds, recent episodes, ECHS/ABHA references). The card is a **portable, offline file** — decryptable only by an authorised reader tied to the on-prem key store. It is not the system of record; it is a resilient, network-independent carrier that makes the record travel with the soldier.

**(c) Reception scanner / card reader.** Reads the card at check-in, decrypts against the local key store, and loads/updates the patient on the **local server**. On discharge it **writes the new episode back to the card**. If the card and server disagree, reception reconciles (server wins for this hospital; card is refreshed).

**(d) On-prem AI server(s).** Where the models and agents run (see §7). Air-gapped by default, with a **controlled, logged internet path** only for the knowledge web-reference bypass (§5).

**(e) ICU device gateway (for Umeed).** See §2a below.

### 2a. How Umeed reads the ICU equipment

Umeed does not talk to each monitor directly. A **bedside/ward device gateway** (a small on-prem appliance, one per ICU or per bay) is the single bridge between the biomedical equipment and RachDev:

```
Multipara monitor (HR/RR/SpO₂/BP/ECG) ┐
Ventilator                            │   ICU DEVICE GATEWAY            RachDev
Infusion pumps                        ├─▶ (on-prem, biomedical VLAN) ─▶ POST /api/icu/observations ─▶ Umeed
Lab analyzer / LIS (troponin,         │   • polls / subscribes          (source = "device")        evaluate → alert
   lactate, creatinine, WBC)          ┘   • normalizes to one schema
```

- **Protocols.** Patient monitors and ventilators export via vendor gateways and open standards — **ISO/IEEE 11073 (PCD)** and **IHE PCD-01**; lab/LIS results arrive as **HL7 v2 ORU^R01** messages (or FHIR Observation). The gateway speaks these, so it works across Philips/GE/Mindray-class monitors and standard LIS.
- **Normalization.** The gateway maps every device reading to RachDev's common observation schema (the same fields a nurse would chart: HR, RR, SpO₂, BP, temp, GCS, plus labs) and **posts to the exact same ingestion API used for manual entry** — tagged `source: "device"` with a `device_id`. So the manual "record observation" step shown in the demo is literally the production path a gateway drives automatically, every few seconds.
- **Umeed is unchanged by the source.** Whether a reading is hand-charted or streamed from a monitor, Umeed runs the same deterministic NEWS2 + qSOFA/lab detection and fires the same early-warning alerts. This is why the demo (manual entry) faithfully represents production (continuous device feed).
- **Security.** The equipment sits on a **segmented biomedical VLAN**; the gateway is the only device that bridges it to the RachDev server; nothing leaves the hospital. Device readings are PHI and stay on-prem like everything else.

> Talk track: *"In production a bedside gateway streams the monitor and lab data straight into Umeed over the same API you just saw me type into — Umeed watches every reading and pages before the bedside team would."*

---

## 3. Multi-hospital continuity — the card as a travelling file

The AFMS moves people. Today a posting means a blank chart at the new unit hospital. RachDev's answer is **two-layered**:

- **Within a hospital:** the on-prem server is the source of truth.
- **Across hospitals (and offline):** the **encrypted card is the patient's portable file.** When a soldier reports to a new unit hospital, reception scans the card and the prior history (conditions, allergies, meds, last episodes) is present immediately — even before any hospital-to-hospital network sync exists. When multiple AFMS hospitals are onboarded, the card is the low-friction bridge; a later ABDM/central-sync path can supplement it, but the card guarantees continuity without dependence on connectivity.

This is the concrete mechanism behind the deck's "**records that follow the soldier**."

---

## 4. Security model (the primary concern)

Security is treated as the precondition, not a feature:

- **On-prem / air-gapped by default.** Models, data and agents run inside the hospital. No PHI leaves the premises. The only outbound path is the optional, admin-enabled knowledge bypass (§5), which sends **no patient data**.
- **Encryption everywhere.** Data encrypted at rest (DB + card) and in transit (LAN/Wi-Fi to the server). The **patient card is independently encrypted**; a lost card is inert without an authorised on-prem reader + key.
- **Identity & least privilege (RBAC).** Every user and device is authenticated; role-scoped access (doctor / reception / store manager / org admin). The voice device is bound to a clinician identity.
- **Human-in-the-loop.** Agents draft and recommend; a clinician approves every clinical action. Diagnosis and treatment are never automated.
- **Append-only audit trail.** Every agent action and human decision is logged with who/what/when/source and the outcome (accepted / **modified** / **overridden**) — reviewable and exportable for DPDP / AFMS record-keeping.
- **DPDP-aligned.** Consent capture at intake (purpose, method, provenance), purpose limitation, data minimisation.
- **Key management.** Card and DB keys held in the on-prem key store; card readers authorised against it.

---

## 5. Knowledge internet-bypass (controlled)

Ira answers **only** from the hospital's approved library by default — correct for an air-gapped deployment. But doctors sometimes need current external references. The **bypass** is a deliberate, safe escape hatch:

- **Off by default; admin-enabled** per hospital (config flag). Air-gapped sites simply leave it off.
- **No patient data leaves.** Only the clinical question/topic is sent; results are **clearly labelled "External — unverified, not from the approved library."**
- **Never a diagnosis.** External results are references for the clinician, not answers about a specific patient.
- **Logged.** Every bypass query is written to the audit trail (agent Ira, source `web`), so use is fully reviewable.

This gives doctors a reference lifeline without compromising the air-gap or the governance story.

---

## 6. Multi-language support

The AFMS serves personnel across every linguistic region. RachDev supports **vernacular voice and text**:

- **Dictation / intake** in English, Hindi, Punjabi, and additional Indian languages (Bengali, Marathi, Tamil, Telugu, Kannada, Gujarati, Malayalam, Urdu) — selectable per session on the voice capture surfaces.
- Agents **structure to a common clinical schema** regardless of input language, so the record and downstream coding stay consistent.
- On-prem ASR/LLM choice (e.g. Sarvam for Indic languages) keeps this working without the cloud.

---

## 7. Hardware requirements — on-prem servers with AI support

Indicative, to be sized against hospital volume during discovery:

| Tier | Purpose | Indicative spec |
|---|---|---|
| **AI/inference node** | Local LLM + ASR (Naina/Asha/Rhea/Ira/Umeed reasoning, vernacular speech) | 1–2× GPU (e.g. 24–80 GB VRAM class) per node; scale by concurrent clinicians; supports on-prem models (Sarvam 30B/105B class) |
| **Application/DB node** | RachDev app, Postgres, audit store, key store | 16–32 vCPU, 64–128 GB RAM, redundant NVMe, encrypted volumes |
| **Edge / capture** | Voice pocket devices, reception card readers/scanners | Hospital LAN/Wi-Fi; devices bound to identities |
| **Resilience** | Backup + HA | Nightly encrypted backups; optional warm standby; UPS |

Design principles: **air-gapped by default**, horizontally scalable per hospital, model tier chosen so the same agents run on cloud (pilot) or on-prem (production) with only a config change.

---

## 8. Why RachDev — and where Dhanvantri falls short

**Framing (say this out loud):** Dhanvantri is the AFMS **system of record**. RachDev is **not a replacement** — it is the **AI operations + interoperability + continuity layer on top of it**. So "better than Dhanvantri" means: everything a records-HIS doesn't do, RachDev adds — without disrupting what Dhanvantri already does.

**Gaps a records-focused HIS like Dhanvantri typically leaves** _(validate specifics with the hospital during discovery):_

| Gap in a records-HIS | What it costs the unit hospital | How RachDev closes it |
|---|---|---|
| **No ambient documentation** — everything typed by the MO | 30–40% of OPD time lost to paperwork | Naina: voice → SOAP + e-prescription, MO reviews not writes |
| **No clinical decision support** — no triage/early-warning | Under-triage, silent deterioration in ICU | Vihaan (acuity/red-flags), Umeed (sepsis/MI/AKI/arrhythmia alerts) |
| **Records don't follow postings** — blank chart at the new unit | History re-collected or missed | Encrypted patient card = portable file across AFMS hospitals |
| **Weak interoperability** — closed, limited/no open API, no ABDM/FHIR | Data siloed; no ABHA continuity | Integration seams (ABDM/ECHS/HIS), FHIR-oriented data model |
| **Manual ECHS coding & claims** — field-ICD misclassified | Claim leakage / denials (HAPO, frostbite, blast) | Rhea: coding + denial-risk screen + cashless pre-auth |
| **No grounded knowledge assistant** | MOs hunt references; no source-cited answers | Ira: approved-library answers + controlled web bypass |
| **Thin governance surfacing** | Hard to audit who did what with AI | Append-only audit trail (accept/modify/override) + DPDP consent |
| **Limited vernacular capture** | Language friction at intake | Multi-language voice/text |
| **Dated, workflow-heavy UX; little automation** | Coordination done by phone/paper | Kabir: beds/OT, referrals, discharge, follow-ups |

**The one-sentence differentiator:** *Dhanvantri stores what happened; RachDev runs the operation around it — capturing it by voice, keeping it with the soldier, watching for deterioration, and getting the claim right — with a clinician in control and nothing leaving the premises.*

> Note: exact Dhanvantri capabilities vary by version/deployment and are not fully public. Present the table as "gaps a records-HIS leaves" and confirm specifics in the discovery session rather than asserting them as fixed facts.
