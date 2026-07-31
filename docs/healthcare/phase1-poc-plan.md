# RachDev Healthcare — 15-Day POC Plan (Claude API build)

Status: Draft for discussion · Owner: Raghav
Build window: **Thu Jul 30 → Thu Aug 14, 2026** (15 days) · Talk: **~Wed Aug 19, 2026** (day 20)
Customer: **Indian Armed Forces (AFMS) military hospital** · Reception HIS: **Dhanvantri** — **production reception is built *over* Dhanvantri; POC uses a standalone companion (no Dhanvantri)**
Audience at the talk: **clinical + exec leadership** (doctors, CMO, CFO)
Model backend for this POC: **Claude API** (build only) — **production is on-prem sovereign Indian/OSS models; we name them explicitly in the talk (see §5a).**

---

## 1. Objective

Turn the scripted `rachdev.com/agents/medical` demo into **two live agent flows** — **Nora (Scribe)** and **Ava (Reception intake)** — plus a **connected Inventory agent ("Kiran")** that closes the prescribe→stock→reorder loop, all running on the **Claude API** for speed of build and wired live into the existing Atlas Control Tower. *(Agent name "Kiran" is a placeholder, easily renamed to match the roster.)*

Because we're using Claude for this round, the POC proves **the workflow, orchestration, and governance**, and tells the on-prem story through architecture rather than a live air-gap. The pitch: *the exact same agents flip to your own open-source models on-prem with a one-line config change — that's the platform.*

**Deliberately deferred to the on-prem build:** the live "data never leaves" proof. See §3 for how we handle that honestly in the room.

## 2. Success criteria (what "done" looks like at day 15)

- Doctor speaks into a mic/phone → transcript → SOAP note draft + suggested CPT/ICD codes → clinician approves → note saved. Reasoning runs on Claude.
- Reception voice intake (**standalone companion — no Dhanvantri integration**): staff/patient speaks → structured intake (name, reason, history, mock eligibility) → opens an encounter in *our* store that hands context to the Scribe flow.
- **Inventory agent (Kiran):** every clinician-approved prescription routes directly to it → projected stock decrements → if a drug falls below its reorder threshold, the **drug store manager gets a shortage alert** (in-app, + SMS/email hook) with a suggested reorder quantity. Out-of-stock drugs are flagged back to the clinician with a substitute suggestion. The agent **stages the reorder — the manager approves; it never auto-purchases.**
- A **live audit log** shows every action, PHI-field access, model call, prescription→inventory hand-off, and the clinician approval — exportable.
- The **provider toggle** is real: a config value flips the agents between `claude` and `on-prem (ollama/vllm)`; we show it even though only `claude` is wired end-to-end this round.
- A **pre-recorded fallback** of a clean end-to-end run exists in case venue Wi-Fi fails.

**Out of scope for the POC:** Dhanvantri integration (no open API — companion app only; ABDM/FHIR or AFMS connector is a production item), real EHR write-back, smartcard hardware, the other five agents (Marcus/Owen/Riley/Iris/Hope stay scripted), the live on-prem/air-gapped deployment, production security hardening.

## 3. Data & compliance rule for this build (important)

Because the Claude API sends data to the cloud, **this POC uses synthetic / de-identified sample encounters only — no real patient data.** State this plainly to the hospital: the POC demonstrates the workflow on synthetic data via Claude; **production runs on-prem on their own models with no egress**, which is exactly why the platform is built model-agnostic. Positioning it this way turns the Claude choice into a strength (fast to prove) instead of a liability.

## 4. Demo narrative (tuned for clinical/exec, ~8 min live)

1. Open on the familiar `agents/medical` Control Tower — the vision they already saw.
2. "Today, two of these agents are no longer a mockup." Start a synthetic patient encounter.
3. **Ava** (Reception): speak a walk-in intake; watch structured fields populate live; an encounter opens.
4. **Nora** (Scribe): play/read a short doctor-patient exchange; the ambient note drafts into a SOAP note with codes; interaction check shown.
5. **The clinician gate:** nothing is saved until the doctor clicks approve. Show the draft-only prescription line.
6. **The supply loop (Kiran):** the moment the prescription is approved, it routes to the Inventory agent — watch stock decrement live, the drug cross its reorder threshold, and a **shortage alert land for the drug store manager** with a reorder quantity. "The prescription didn't just become a note — it updated the pharmacy's stock and flagged a reorder, automatically." Strong readiness/logistics beat for a military hospital.
7. **The sovereignty moment (replaces the air-gap moment):** open the config, flip `provider: claude → provider: on-prem`, and name the production stack out loud — "the agents you just watched are model-agnostic. In your hospital they run **on Indian open-source models on your own hardware, nothing leaving the base**: **Sarvam** for reasoning, **IndicWhisper** (AI4Bharat / IIT Madras) for transcription, **IndicTrans2** for regional languages — all permissively licensed, all on the government's AI Kosh. Same agents, one line." Show the audit log capturing every action. *This framing is essential for a defence audience — it answers 'why is a US cloud touching our data?' before they ask.*
8. Close on ROI: minutes from intake to chart, hours back for clinicians, fewer stockouts on the shelf, and "your data, your hardware, your models in production."

## 5. Architecture (POC vs production)

```
Mic / phone ─► Whisper ASR (local, CPU) ─► Atlas (agent manager) ─► Ava intake agent
                                                             └──► Nora scribe agent ─► SOAP + codes + Rx
                                                                        │ (on clinician approval)
                                                                        ▼
                                                             Kiran inventory agent ─► stock ↓, reorder alert → store manager
                                    Guardrail (PHI redaction + audit) wraps every step
                                    Clinician approve UI (reuse Control Tower) ─► save note
LLM reasoning: Claude API  (production: swap to on-prem vLLM/Ollama via AgentSpec — no code change)
Kiran is mostly deterministic (stock table + thresholds); LLM only for the shortage message + substitute suggestion.
```

- **Node control tower (existing):** serve the UI, sessions, SSE streaming, approval endpoint, audit write. `agentController` already speaks to the Anthropic SDK — we reuse that path directly for the POC instead of ripping it out.
- **Python agent service (new, thin):** FastAPI + a light LangGraph supervisor hosting Ava + Nora + Guardrail. Uses the `AgentSpec` abstraction with `provider: claude` now, `vllm/ollama` later. This abstraction is the single most important thing to build correctly — it's what makes the production on-prem swap a config change.
- **ASR stays local:** IndicWhisper (Hindi + Punjabi), run locally — no cloud — so the audio transcription already never leaves the machine, a nice detail to mention. Note this means even in the Claude-backed POC, the Indian-built speech model is already in the loop.
- **Kiran (Inventory) is deliberately lightweight:** a Postgres `drug_stock` table + reorder thresholds + a notifier reusing the existing `sms.js` / `brevo.js` services. LLM is used only for the human-readable shortage message and substitute suggestion, so it adds little build risk while adding a full end-to-end loop. If the timeline tightens, it can gracefully drop to a scripted beat.
- **No vector DB / queue required** for the POC. RAG optional if time permits.

## 6. Model plan

| Component | POC choice | Notes |
|---|---|---|
| LLM reasoning | **Claude (Sonnet for most, Opus for the note-quality pass if needed)** | via existing `@anthropic-ai/sdk`; API key required |
| ASR | **IndicWhisper (Hindi + Punjabi), local** — with base Whisper large-v3 as English fallback | **Confirmed: room needs Hindi + Punjabi.** Punjabi is where base Whisper is weak, so use IndicWhisper (AI4Bharat) even in the POC — it runs locally, so this is independent of the Claude LLM choice. Transcript (Hindi/Punjabi) → **English SOAP note** via the LLM. May want a small GPU for speed; rehearse on CPU first. |
| PHI redaction | **Presidio** + a few custom recognizers | runs before anything is logged/displayed |
| Hardware | **Any laptop + internet + Anthropic API key** | GPU / rental no longer needed for this build |

**Net effect of the Claude switch:** no GPU procurement, no model-serving to stand up, no air-gap networking — the two flows get more build time and polish. The on-prem hardware/model work moves to the *next* phase.

### 5a. Production on-prem model stack — state this explicitly in the talk

The POC runs on Claude, but a defence audience needs to hear, clearly, what runs **in production on their own hardware with nothing leaving the base**. Name these on a slide and at the provider-toggle moment:

| Role | Production on-prem model | Why (for AFMS) |
|---|---|---|
| Reasoning / notes / coding | **Sarvam-105B** (or **Sarvam-30B** on smaller GPU) — Apache 2.0, on AI Kosh | India's first from-scratch open LLM; sovereign, no per-call fees, strong Indian-language + tool use |
| Transcription (ASR) | **IndicWhisper / IndicConformer** (AI4Bharat, IIT Madras) — incl. **Hindi + Punjabi** | Far better than base Whisper on Hindi + Punjabi accents; Indian-built. Same model used in the POC. |
| Regional translation | **IndicTrans2** (AI4Bharat) | Normalizes regional-language notes to English for coding |
| English A/B option | Qwen2.5 / Llama-3.3 | Head-to-head comparison only |

One-line message for the room: **"Indian models, Indian hardware, inside your base — demonstrated fast on Claude today, deployed sovereign tomorrow."**

## 7. Reuse map (don't rebuild)

- Control Tower / Atlas UI, agent roster, audit-log UI — already in `industry-demo/*`; make Ava + Nora data live instead of mock.
- `agentController.js` sessions + SSE streaming + Anthropic SDK — **reuse as-is** for the POC (this is now less work than the on-prem plan).
- RBAC + auth — reuse for the "clinician approves" gate.
- The `agents/medical` page — the day-20 talk opens on it.

## 8. 15-day timeline (dated)

**Sprint 1 — Foundation (Thu Jul 30 → Sat Aug 2)**
- FastAPI agent service skeleton + `AgentSpec` (`provider: claude | vllm | ollama`), wired to `claude`.
- Whisper local ASR running on CPU.
- Confirm the existing Node → Anthropic path works for a scripted agent turn end to end.
- Exit check: audio in → transcript → Claude response → UI, one clean pass.

**Sprint 2 — Live flows (Sun Aug 3 → Fri Aug 8)**
- Nora: streaming ASR → SOAP draft + CPT/ICD suggestion + interaction note + structured Rx.
- Ava: voice intake → structured fields → open encounter → hand context to Nora.
- Guardrail: Presidio redaction + append-only audit entries.
- Clinician approve UI wired to Control Tower; splice Ava + Nora live into the Atlas view.
- Exit check: full intake→note→approve runs end to end on synthetic data.

**Sprint 3 — Inventory agent + governance + polish (Sat Aug 9 → Tue Aug 12)**
- **Kiran (Inventory):** seed a drug-stock table with reorder thresholds; on approved Rx → decrement stock → threshold check → shortage alert to store manager (in-app + SMS/email hook, reuse existing `sms.js`/`brevo.js`); out-of-stock → substitute suggestion back to clinician. Add a simple store-manager view + reorder-staging (approve-only, no auto-purchase).
- Audit-log view + export (incl. Rx→inventory hand-off); the **provider-toggle** config moment.
- Accuracy pass on 5–10 realistic synthetic encounters; tune prompts.
- **Hindi + Punjabi ASR (IndicWhisper)** wired and rehearsed on sample audio in both languages → English note. Optional: RAG over a handful of protocol PDFs.
- Exit check: prescribe→approve→stock-decrement→shortage-alert runs reliably on 10 sample runs.

**Sprint 4 — Harden the demo (Wed Aug 13 → Thu Aug 14)**
- 3 full dry runs; failure drills (mic fails, API slow/timeout, Wi-Fi flaky).
- Record the **fallback video** of a clean end-to-end run.
- Freeze code. Write the demo runbook.

**Days 16–20 (Fri Aug 15 → ~Wed Aug 19) — Rehearse & pitch**
- Rehearse the 8-min narrative; build the exec deck around the live demo.
- One-page leave-behind: what's real today (workflow on Claude) vs production (on-prem, own models).
- Buffer for on-site setup.

## 9. Risks & mitigations

- **Venue Wi-Fi fails** → Claude API now *needs* connectivity, so this is a real risk: bring a mobile hotspot **and** the pre-recorded fallback video.
- **API latency/timeouts on stage** → pre-warm, cap output length, stream tokens so it feels responsive; Sonnet over Opus for speed.
- **Defence-audience cloud optics ("why is a US cloud touching our data?")** → the single most important framing risk. Get ahead of it: synthetic data only, on our own box; lead with §5a — Sarvam + IndicWhisper on-prem in production, nothing leaving the base. Never let this be a question they raise first.
- **Transcription weak on accents/medical terms** → curated demo audio + term biasing; rehearse with the presenter's voice.
- **They expect Dhanvantri integration in the demo** → set expectations early: companion app now, standards-based (ABDM/FHIR) or AFMS-brokered integration is a defined production phase.
- **Scope creep toward EHR/smartcard/on-prem** → frozen out; shown as roadmap.

## 10. ROI talking points (for the exec room)

- **Minutes, not hours:** intake, eligibility and pre-charting done before the patient is in the room.
- **Hours back for clinicians:** drafted notes and codes — physicians spend ~2 hrs on desk work per 1 hr of care today (Sinsky et al.).
- **Cleaner claims:** coding + denial checks before submission.
- **Supply readiness:** prescriptions update pharmacy stock in real time and flag reorders before shelves run dry — a direct fit for a military hospital where stockouts are an operational risk, not just a cost.
- **Your data, your hardware, your models in production:** demonstrated fast on Claude today, deployed sovereign on-prem tomorrow — the differentiator no cloud scribe leads with.
- Framed as pilot targets validated on their own data, never guarantees.

## 11. Open items to confirm before day 2

- Anthropic API key / billing access for the build.
- Languages = **Hindi + Punjabi** (confirmed) → IndicWhisper for ASR, English clinical notes. Need 2–3 sample audio clips per language to rehearse on.
- A few realistic **synthetic** (non-PHI) sample encounters to tune and rehearse on.
- Presenter for the live demo (rehearse with their voice).
- Agreement on how explicitly to frame "Claude now, on-prem in production" with this hospital.
