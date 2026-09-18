# Agent Runtime Contract v1

**Date:** 2026-08-05
**Status:** Implemented (RachDev client side) — RachBase server side to be built to this contract
**Migration step:** #5 in `docs/RACHDEV_ARCHITECTURE_PROPOSAL.md`
**Builds on:** `docs/RACHDEV_AGENTSPEC_CONTRACT.md` (the artifact deployed here).

---

## 1. What this is

The runtime contract is the seam between RachDev's **control plane** (build, monitor, bill) and the **data plane** where an agent actually runs. It replaces infrastructure verbs (`run-command`, `trigger-deploy` a git service) with **agent verbs**: deploy a published spec, ask about its status/metrics/logs, stop it. RachDev never names a VM or sends a shell command — the runtime decides internally which container on which VM runs a spec.

This is introduced **alongside** the legacy `rachbaseClient` (infra verbs), not as a replacement yet; removing the infra verbs is migration step #6.

## 2. What gets deployed

Only a **published, immutable version** (`agent_spec_versions`, from the AgentSpec contract). Deploying reads that snapshot and hands it to the runtime. A running agent is therefore pinned to a spec that cannot change under it; redeploying moves it to a new version explicitly.

## 3. Targets

The target comes from the spec's `runtime_target.type`:

| Target | Mode | Behavior |
|---|---|---|
| `rachbase` | **push** | RachDev calls RachBase's internal agent-runtime API; RachBase provisions/updates a container and returns a handle. Default; the only fully-wired target in v1. |
| `onprem` | **pull** | The customer's runtime agent fetches the published spec and runs it inside their network; it phones **metadata telemetry** home. RachDev never reaches in. |
| `byoc` | **pull** | Same as on-prem, in the customer's cloud. Later phase. |

For pull targets, control calls (`status`/`metrics`/`logs`) return a `pending`/metadata result rather than a live call into the customer's network. Raw conversation content never leaves the customer premises — only counts, health, and statuses flow back.

## 4. RachDev-side API (implemented)

Mounted under `/api/agent`, gated to `tenant_admin`/`admin`, tenant-scoped:

| Method | Path | Purpose |
|---|---|---|
| POST | `/definitions/:id/deploy` | Deploy the agent's current published version to its target. `201` running · `202` pending (pull) · `409` if never published · `502` on runtime failure (recorded). |
| GET | `/deployments` | Current deployments for the tenant. |
| GET | `/deployments/:id/status` | Live status (metadata); persists the snapshot. |
| GET | `/deployments/:id/metrics` | Operational metrics (aggregates only). |
| GET | `/deployments/:id/logs` | Operational logs (redaction-aware; empty for pull targets). |
| POST | `/deployments/:id/stop` | Stop the deployment. |

State is tracked in `agent_deployments` (one row per `(tenant_id, agent_key)`, pinned to a version, metadata only).

## 5. RachBase-side API (to implement to this contract)

RachDev's `agentRuntimeClient` calls these on RachBase, authenticated by the shared `RACHBASE_SERVICE_TOKEN` (same pattern as the existing `/internal/*` routes). RachBase owns the container/VM substrate behind them.

```
POST /internal/agent-runtime/deploy
  → { tenant_id, agent_key, version, spec }        ⇐ { handle, status, endpoint }
POST /internal/agent-runtime/status
  → { tenant_id, handle }                          ⇐ { status, endpoint? }
POST /internal/agent-runtime/metrics
  → { tenant_id, handle }                          ⇐ { metrics: {...} }         # aggregates only
POST /internal/agent-runtime/logs
  → { tenant_id, handle, limit }                   ⇐ { logs: [...] }            # redaction-aware
POST /internal/agent-runtime/stop
  → { tenant_id, handle }                          ⇐ { status }
```

`status` values: `pending | running | stopped | failed`. `endpoint` is channel metadata (e.g. a widget URL or a phone-number reference), never content. RachBase verifies that `tenant_id` owns the target before acting — the same trust boundary as today's `/internal/deploy`.

## 6. Telemetry principle

Everything that flows **runtime → control** is metadata: status, counts, latency, error rates, channel endpoints. No conversation/records. This is what keeps the dashboard identical — and safe — whether the agent runs on RachBase or inside a hospital that cannot let data leave. Build the pull-target telemetry ingestion to this rule from day one.

---

## 7. Implementation status (2026-08-05)

**Done (RachDev side, code only — needs `npm run migrate` + a live RachBase to exercise the push path):**
- `050_agent_deployments.sql` — deployment state table.
- `AgentDeployment` model (`upsert`/`list`/`find`/`updateStatus`), exported from `@rach/core`.
- `apps/rachdev-backend/src/services/agentRuntimeClient.js` — `deploy/status/metrics/logs/stop`, target-aware (rachbase push, onprem/byoc pull).
- `apps/rachdev-backend/src/controllers/deploymentController.js` + routes on `/api/agent`.

**Step #6 — done (2026-08-05):** the DevOps deployment-assistant agent was retired from RachDev.
- The `/sessions/:id/chat` handler is now the **AgentSpec builder assistant** — it helps design/configure agents in natural language, with the tenant's agents + templates as context, and no infrastructure vocabulary.
- `trigger-deploy` and `run-command` handlers + routes removed; `services/rachbaseClient.js` (infra verbs) deleted; the chat no longer reads `vm_ssh_config`/`deployment_services`.
- Agents are now deployed only through the Agent Runtime Contract (published version → runtime target).

**Not done (next):**
- RachBase implements `/internal/agent-runtime/*` (server side of §5). *RachBase repo — out of scope for this window.*
- Pull-target telemetry ingestion (the endpoint the on-prem runtime agent phones home to) + the runtime agent itself (architecture proposal §11, the largest lift).
- Data ownership: the `vm_ssh_config` / `deployment_services` tables still live in the shared DB. RachDev no longer references them; formally relocating them to RachBase is a RachBase-side task.
