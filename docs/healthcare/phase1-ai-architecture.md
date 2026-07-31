# RachDev Healthcare — Phase 1 AI Architecture

Status: Draft for discussion · Owner: Raghav · Scope: Phase 1 = AI solution only (on-prem hospital)

---

## 1. Scope and locked assumptions

- **Customer: an Indian Armed Forces (AFMS) military hospital.** This raises the bar to **MoD-grade security**: air-gapped, on-prem, and **no foreign/commercial cloud** in production. It also makes the sovereign-Indian-model story (see §6a) the central pitch, not an option.
- Single hospital, deployed **inside the hospital's own server room** (their GPU + CPU boxes).
- **Open-source LLMs only.** No cloud inference. **No patient data leaves the hospital network.**
- Security is a first-class requirement, not a later add-on.
- Doctor phone-transcription app talks to the **internal server only**.
- Reception runs **Dhanvantri** (the AFMS integrated HIS). We assume **no open partner API** and deploy an **AI companion/overlay** beside it — see §8.
- Patient data can live on a **physical smartcard**; we supply the reader/writer hardware + the software on it.
- Phase 1 delivers the AI solution. RachBase is **out of scope**. We work in RachDev FrontEnd + BackEnd.
- Orchestration model: **agent manager (supervisor) + a team of specialist agents**, built agent by agent.

Decisions taken in this pass: hybrid Node+Python runtime · flagship agents = Doctor Scribe **and** Reception overlay · generic PHI data model mapped to both DPDP and HIPAA · model stack recommended below.

---

## 2. What we reuse from RachDev (don't rebuild)

The existing platform already gives us most of the "control tower." We keep it and swap the model backend.

| Existing asset | Reused as |
|---|---|
| Next.js 14 dashboard `(dashboard)` — tenants, deployment, vm-monitor, monitoring, billing | Hospital admin / **Control Tower** UI for agents, health, audit |
| Node/Express + Postgres, JWT + RBAC (`tenant_admin`, `tenant_user`, `developer`) | Auth, role gating, tenant isolation → extended with clinical roles (doctor, reception, records-officer) |
| `agentController.js` (sessions, streaming chat, run-command, trigger-deploy) | Session/chat plumbing and SSE streaming — **rewired from Anthropic cloud to on-prem model gateway** |
| `deployRunner.js` (SSH) + `terminalServer.js` + `prometheus.js` | On-prem deploy + GPU/agent monitoring |
| `industry-demo/*` (AgentRoster, Architecture, ControlTower, Governance) | The public "team of agents" story is already built — reuse as the product narrative |

**Must change:** the `@anthropic-ai/sdk` path in `agentController.js` and the Razorpay credit metering. Cloud inference and external billing violate the no-egress rule. On-prem we meter usage internally (for capacity, not payment) and license per-site instead.

---

## 3. Deployment topology — one hospital, zero egress

Three network zones inside the hospital, no outbound internet for PHI paths:

1. **Clinical edge zone** — doctor mobile app, reception workstations + smartcard stations. Talks only to the app zone over the internal LAN/VLAN.
2. **Application zone (CPU)** — Node control tower/API gateway, Python agent service, Postgres, vector DB, Redis, audit store.
3. **Inference zone (GPU)** — vLLM (LLM), Whisper ASR, embedding server. Only the agent service may call it.

Egress is default-deny. The only allowed outbound is optional, opt-in model/software updates through a staging box — never PHI.

---

## 4. Runtime — hybrid Node + Python

Chosen because the OSS agent/inference ecosystem (vLLM, Whisper, LangGraph) is Python-native, while your product, auth, and dashboard are Node.

- **Node control tower (existing backend)** — API gateway, auth/RBAC, tenant + clinical user management, sessions, SSE streaming to the frontend, audit write path, deploy/monitoring. The frontend never talks to Python directly.
- **Python agent service (new)** — FastAPI + an orchestration lib (LangGraph recommended) hosting the **agent manager and all agents**. Calls the model servers, runs tools, enforces guardrails.
- **Between them** — internal HTTP + SSE for live turns; **Redis queue** for async/long jobs (audio transcription, batch summaries). One internal service token, mTLS between zones.

```
Frontend ──HTTPS──> Node control tower ──HTTP/SSE + Redis──> Python agent service ──HTTP──> vLLM / Whisper / Embeddings
```

---

## 5. Agent architecture — manager + team

**Agent Manager (supervisor)** receives a typed intent from the control tower, plans, and routes to one or more specialist agents. Every inbound and outbound message passes through the **Guardrail/Compliance agent** (PHI redaction, safety, and audit logging). Agents are stateless workers; state lives in Postgres + the session store.

Phase-1 agents:

- **Doctor Scribe agent** — takes a live/near-live audio stream, produces a structured clinical note (SOAP), flags follow-ups. Depends on Whisper + LLM.
- **Reception/Front-desk agent** — overlay actions on the existing reception app: patient lookup/registration, appointment, triage questions, card read/write hand-off.
- **Patient-Card agent** — reads a patient's smartcard into working context and writes back approved updates (via the reception station hardware bridge).
- **Inventory/Pharmacy-Stock agent ("Kiran")** — receives every clinician-approved prescription directly, decrements projected drug stock, checks reorder thresholds, and notifies the **drug store manager** on shortage/out-of-stock with a suggested reorder quantity and substitute. Mostly deterministic (stock table + thresholds); LLM only for the shortage message and substitute suggestion. **Stages reorders for human approval — never auto-procures** (critical in a military supply context).
- **Knowledge/RAG agent** — retrieval over hospital protocols, formulary, and SOPs (vector DB). Grounds the other agents; keeps clinical content updatable without retraining.
- **Guardrail/Compliance agent** — PHI detection/redaction (Presidio + rules), refusal/safety checks, and immutable audit entries for every action.

Contracts between agents are typed (JSON schema) so we can build, test, and swap them **agent by agent**. The manager + guardrail + one real agent is the minimum first slice.

---

## 6. Recommended model stack (open-source, on-prem)

Recommendation favors strong **general** open models grounded by RAG over hospital content, rather than older medical-tuned checkpoints — general models now match or beat them on most clinical NLP, and RAG keeps knowledge current and auditable.

| Role | Recommendation | Notes / GPU |
|---|---|---|
| Primary LLM | **Qwen2.5-72B-Instruct** or **Llama-3.3-70B-Instruct** via **vLLM** (OpenAI-compatible API) | ~2×A100/H100 80GB at fp16, or 1 GPU with AWQ/GPTQ 4-bit. Start here. |
| Small/fast LLM | **Qwen2.5-7B/14B** | Cheap routing, redaction, structured extraction; runs on a single mid GPU. |
| Clinical option (later) | **OpenBioLLM-70B** / **Meditron** as a swappable base | Keep as A/B, not the default. |
| ASR (transcription) | **IndicWhisper** for **Hindi + Punjabi** (confirmed languages); Whisper large-v3 for English | Diarization + medical-term biasing. GPU-served. Transcript → English clinical note. |
| Embeddings (RAG) | **BGE-m3** or **multilingual-e5-large** | Multilingual for India; runs on CPU or small GPU. |
| Vector store | **pgvector** (reuse Postgres) to start; **Qdrant** if scale demands | Keeps infra footprint small. |
| PHI redaction | **Microsoft Presidio** + custom recognizers | Deterministic layer before/after LLM. |

vLLM gives us an OpenAI-compatible endpoint, so the Node `agentController` rewire is a base-URL + auth swap plus removing cloud/billing logic.

### 6a. Indian / sovereign models (recommended for an Indian hospital)

For a hospital in India, Indian-built open models are not just a nice-to-have — they strengthen the sovereignty pitch (Indian data, Indian models, Indian hardware) and materially improve multilingual clinical use across Hindi and regional languages. They slot into the exact same `AgentSpec`/vLLM serving layer, so adding them is a config choice, not a re-architecture. We can even **route by language**: Indic-language encounters → Indian models, English clinical reasoning → whichever model scores best.

| Role | Indian option | Why it fits |
|---|---|---|
| Primary / multilingual LLM | **Sarvam-105B** (or **Sarvam-30B** for smaller GPU) — MoE, Apache 2.0, released Feb 2026, weights on Hugging Face + AI Kosh | India's first from-scratch open LLM; leads Indian-language benchmarks, strong at numbers-in-language and tool calls (useful for agent workflows); permissive license for on-prem |
| Alternative LLM | **Krutrim** (Ola) — built from the ground up on Indian data | Sovereign alternative; evaluate head-to-head with Sarvam on clinical prompts |
| ASR (Indian languages) | **IndicWhisper / IndicConformer** (AI4Bharat, IIT Madras) — **Hindi + Punjabi** confirmed; 22 languages available, Apache 2.0, on AI Kosh + Hugging Face | Whisper fine-tuned on Indian speech (Kathbath, IndicVoices); far better than base Whisper on Hindi + Punjabi accents for the doctor-transcription flow |
| Translation | **IndicTrans2** (AI4Bharat) — 22 Indian languages | Normalize regional-language notes to English for coding, or vice-versa |
| National platform hook | **Bhashini** (govt Digital India language stack) | Optional alignment with government language infrastructure; good for public-sector / ABDM optics |

Practical default for India: **Sarvam** as the primary LLM (with Qwen2.5/Llama-3.3 as an English A/B), **IndicWhisper** for ASR, **IndicTrans2** where translation is needed, all served through vLLM behind the same agent layer. Licenses are permissive (mostly Apache 2.0), so on-prem deployment carries no per-call fees.

---

## 7. Flagship flow A — Doctor Scribe (phone → note)

1. Doctor opens the app, starts a visit. App streams audio over the **internal network only** to the ASR gateway (WebSocket).
2. Whisper transcribes (diarized). Guardrail agent tags PHI spans.
3. Scribe agent turns transcript → structured SOAP note; RAG agent grounds terminology/orders against hospital protocols.
4. Draft returns to the doctor for **review + sign-off** (human in the loop — never auto-commit).
5. Signed note is stored on-prem and, if applicable, written to the patient smartcard via the reception/card bridge. Full audit trail recorded.

## 8. Flagship flow B — Reception companion (Dhanvantri)

The hospital runs **Dhanvantri**, the AFMS integrated HIS. **Production intent: the Reception flow is built *over* Dhanvantri** — reading patient/appointment context from it and writing back registrations/appointments — so staff have one system of record, not two. **For the POC only**, because Dhanvantri exposes no open partner API we can build against in the timeframe, the Reception agent runs as a **standalone companion** (no Dhanvantri integration); staff use both and our side owns only what we capture. The companion is a POC bridge, not the end state.

1. Reception agent runs as a companion window/side panel. It does not read or write Dhanvantri.
2. Patient taps smartcard at the station → Card agent loads context from **our** on-prem store; Reception agent shows summary, verifies identity, handles registration/appointment/triage in our workflow.
3. Any write → staff confirm → Card agent writes back to card + on-prem store. Guardrail logs it. Staff mirror into Dhanvantri manually until an integration exists.

**Production integration path (post-POC), in order of preference:**

- (a) **ABDM FHIR R4 + ABHA** — India's national interoperability standard (HIP/HIU model); the clean, standards-based route **if** the military network is permitted ABDM connectivity. Many Indian HIS are being pushed toward ABDM compliance.
- (b) **AFMS/DGAFMS-brokered connector** — an official integration with Dhanvantri via the vendor/AFMS. Standards-based (HL7/FHIR) if available, but a long procurement — not a POC item.
- (c) **Screen-level automation** — last resort only.

Until (a) or (b) lands, the companion model keeps us fully useful with zero dependency on Dhanvantri's internals.

---

## 9. Patient smartcard design

- **Card**: encrypted chip card. Store a compact, encrypted PHI record (demographics, allergies, key history, med list, last-visit summary) — **not** the full EHR. Card is a portable cache, source of truth stays on-prem.
- **Crypto**: data encrypted with a hospital key; card holds an ID + encrypted blob. Reader authenticates to the station; keys never leave the app zone. Lost card ≠ readable PHI.
- **Hardware bridge**: a small local service on the reception workstation (PC/SC / vendor SDK) exposes read/write to the Card agent over the LAN. We provide reader + card + this software.
- **Sync**: card write is transactional with the on-prem record; conflicts resolved server-side with audit.

## 10. Data model (generic PHI, mapped to DPDP + HIPAA + MoD/AFMS)

Core entities: `Patient`, `Encounter`, `ClinicalNote`, `Prescription`, `DrugStock`, `StockTransaction`, `ReorderAlert`, `Consent`, `AuditEvent`, `CardRecord`, `AgentSession`. An approved `Prescription` links to `StockTransaction` (decrement) and may raise a `ReorderAlert` to the store manager. Design rules that satisfy all regimes:

- **Consent-first**: every access checks a `Consent` record (DPDP purpose limitation; HIPAA authorization). ABHA/ABDM health-ID slots into `Patient` for India.
- **Minimum necessary**: agents receive only the fields their task needs; redaction by default.
- **Immutable audit**: every read/write/agent action → append-only `AuditEvent` (who, what, when, purpose). Serves HIPAA §164.312, DPDP accountability, and MoD/AFMS record-keeping.
- **Encryption**: at rest (DB + card) and in transit (mTLS internal). Key management in the app zone.
- **Data residency & sovereignty**: nothing leaves the hospital; no foreign cloud in production. Satisfies DPDP/HIPAA and the MoD/AFMS requirement by construction.
- **Military note**: patient records may include serving personnel — treat rank/unit/deployment as sensitive; access is need-to-know and fully audited.

## 11. Phase-1 build order

1. **Foundation** — stand up vLLM + Whisper + embeddings in the inference zone; Python agent service skeleton (FastAPI + LangGraph); rewire Node `agentController` to the on-prem gateway; drop cloud/billing path.
2. **Agent Manager + Guardrail** — supervisor routing + PHI redaction + audit, with one trivial agent end-to-end.
3. **Doctor Scribe** — ASR streaming → SOAP draft → doctor sign-off in the app.
4. **Inventory/Pharmacy-Stock (Kiran)** — prescription → stock decrement → reorder alert to store manager.
5. **Reception + Card agent** — smartcard bridge, patient context, registration/appointment. **Built over Dhanvantri** in production (see §8); companion-only in the POC.
6. **Knowledge/RAG** — load hospital protocols; ground scribe + reception.
7. **Hardening** — audit UI in the dashboard, role expansion, pen-test, failure/rollback drills.

## 12. Open questions before build

- Reception HIS = **Dhanvantri (AFMS)** — confirmed. Open sub-question: is this hospital **permitted ABDM/ABHA connectivity**, or fully air-gapped from it? Decides whether production integration path (a) or (b) applies.
- Is there an **official AFMS/DGAFMS route** to integrate with Dhanvantri (vendor contact, HL7/FHIR export), or is manual mirroring the only near-term option?
- **GPU inventory** available in the server room (count/model/VRAM)? Sets production model size (Sarvam-105B vs 30B) + quantization.
- Languages = **Hindi + Punjabi** (confirmed). IndicWhisper covers both; clinical notes rendered in English. Punjabi may be Gurmukhi or romanized — confirm expected script for display.
- Smartcard: any **existing military ID/card standard** to interoperate with, or greenfield?
- Any **MoD/AFMS security accreditation** we must pass (empanelment, audit, pen-test standard) before deployment?
