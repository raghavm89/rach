# AgentSpec Contract v1

**Date:** 2026-08-05
**Status:** Proposed contract for review (no code changed yet)
**Migration step:** #4 in `docs/RACHDEV_ARCHITECTURE_PROPOSAL.md`
**Grounds on:** `packages/core/src/models/agentDefinition.js`, `packages/core/src/db/migrations/048_agent_definitions.sql`, `apps/rachdev-web/src/data/templates.ts`.

---

## 1. Why this exists

The AgentSpec is the **one artifact that crosses the RachDev seam**: the builder writes it, a runtime executes it, the dashboard monitors it. For that to work, both sides must agree on its exact shape. Today there is no such agreement:

- The persisted `AgentDefinition` (`agent_definitions` table) stores `tools` and `guardrails` as **free-form JSONB with no defined shape** — anything validates. Creation checks only that `key` and `name` are non-empty.
- There is **no versioning or lifecycle** — `update()` mutates the row in place, so a deployed agent can silently change under itself. The only state is a boolean `enabled`.
- There is **no channel or runtime-target information** — nothing says where the agent is exposed or where it runs (both required by the architecture proposal).
- A second, richer representation exists on the marketing side (`Template` in `templates.ts`) with `capabilities`, `integrations`, `guardrails` as descriptive strings. Its relationship to the operational spec is undefined.

This document defines AgentSpec v1: the canonical schema, the shapes of `tools[]` and `guardrails{}`, a versioning/lifecycle model, and how it relates to the catalog `Template`. It closes with the DB + validation work to adopt it (not yet applied).

---

## 2. Two related objects — keep them distinct

| Object | Lives in | Audience | Role |
|---|---|---|---|
| **Template** (catalog) | `templates.ts` (later: `agent_definitions` with `tenant_id IS NULL`) | Marketing + builder browse | Human-facing description of a pre-built agent: capabilities, integrations, what's configurable. The *starting point*. |
| **AgentSpec** (this doc) | `agent_definitions` (+ a versions table) | Builder writes · runtime reads · dashboard monitors | The machine-executable definition of one configured agent. The *contract*. |

The builder flow is: pick a **Template** → the builder produces a **draft AgentSpec** (`template_ref` records the lineage) → the customer customizes it → publish → deploy. Template is catalog metadata; AgentSpec is the operable contract. They stay separate schemas, linked by `template_ref`.

---

## 3. The canonical AgentSpec (field by field)

Grouped by concern. "Source" shows the relationship to today's `agent_definitions` column: **kept** (exists), **new** (add), **reshaped** (exists but shape now defined).

### Identity & lineage
| Field | Type | Req | Source | Meaning |
|---|---|---|---|---|
| `spec_version` | string (`"1.0"`) | yes | new | Version of *this contract*, so readers can evolve safely. |
| `id` | integer | yes (server) | kept | Instance id. |
| `tenant_id` | integer \| null | yes | kept | `null` = platform template; non-null = a tenant's configured agent. |
| `key` | string (slug) | yes | kept | Stable identifier within the tenant. `UNIQUE(tenant_id, key)`. |
| `template_ref` | `{ slug: string, version: int } \| null` | no | new | The catalog Template this was derived from (lineage), or null if authored from scratch. |
| `industry` | string \| null | no | new | Industry module this agent belongs to (e.g. `"healthcare"`). Drives dashboard routing; today only derivable from the tenant. |
| `name` | string | yes | kept | Display name. |
| `role` | string | no | kept | Short role label (e.g. `"Scribe"`, `"Reception"`). |
| `description` | string | no | new | One-paragraph human summary. |

### Behavior
| Field | Type | Req | Source | Meaning |
|---|---|---|---|---|
| `prompt` | string | no | kept | System prompt. Empty ⇒ runtime uses the agent-type default (as `scribe.js` does today). |
| `model_policy` | `{ class: "fast"\|"balanced"\|"reasoning", pin?: string }` | yes | reshaped from `provider`+`model` | The gateway resolves `class` → concrete model per environment (Claude in POC, on-prem vLLM/Sarvam in prod) — the point of `@rach/llm`. `pin` optionally forces a specific catalog model id. Replaces raw `provider`/`model` on the spec so specs are environment-portable. |
| `tools` | `Tool[]` | no | reshaped | See §4. Was untyped JSONB. |
| `guardrails` | `Guardrails` | no | reshaped | See §5. Was untyped JSONB. |
| `knowledge` | `{ sources: KnowledgeSource[] } \| null` | no | new | Optional retrieval config (docs/KB the agent may cite). |

### Deployment
| Field | Type | Req | Source | Meaning |
|---|---|---|---|---|
| `channels` | `Channel[]` | no | new | Where the agent is exposed: web widget, WhatsApp, voice, API. See §6. |
| `runtime_target` | `{ type: "rachbase"\|"onprem"\|"byoc", ref?: string }` | yes (at deploy) | new | Where the runtime executes. Defaults to `rachbase`. `onprem`/`byoc` carry a `ref` to the customer's runtime-agent registration. |

### Lifecycle & audit
| Field | Type | Req | Source | Meaning |
|---|---|---|---|---|
| `status` | `"draft"\|"published"\|"deployed"\|"disabled"` | yes | reshaped from `enabled` | Explicit lifecycle. Replaces the boolean. |
| `version` | integer | yes | new | Monotonic published version. See §7. |
| `created_at` / `updated_at` | timestamptz | yes | kept | — |
| `published_at` | timestamptz \| null | no | new | When the current `version` was published. |
| `created_by` | integer (user id) \| null | no | new | Author, for audit. |

---

## 4. `Tool[]` — defined shape

Each tool is a typed, individually-toggleable capability. Free-form config is confined to `config`, but `type` is a closed set so the runtime knows how to invoke it.

```ts
type ToolType =
  | "http_action"      // call an external HTTP endpoint (integrations)
  | "knowledge_base"   // retrieve from an attached knowledge source
  | "handoff"          // escalate/transfer to a human or another agent
  | "function";        // a named capability the runtime implements natively

interface Tool {
  id: string;              // stable slug, unique within the spec
  type: ToolType;
  name: string;            // human label
  enabled: boolean;        // default true
  config: Record<string, unknown>;  // shape depends on `type` (see below)
}
```

Per-type `config` (v1 minimum):
- `http_action`: `{ method, url, headers?, auth_ref?, input_schema?, timeout_ms? }` — secrets referenced by `auth_ref`, never inlined.
- `knowledge_base`: `{ source_id, top_k? }`.
- `handoff`: `{ target: "human" | "agent", queue?, agent_key? }`.
- `function`: `{ fn: string, args_schema? }`.

> The marketing `Template.integrations` (e.g. "Shopify", "Zendesk") map to `http_action` tools when a template is instantiated.

---

## 5. `Guardrails` — defined shape

Was `{}`-anything. Defined as a structured, optional-by-field object so the runtime can enforce consistently:

```ts
interface Guardrails {
  pii?: {
    redact?: boolean;                 // strip PII from logs/telemetry (default true for onprem)
    block_output?: boolean;           // refuse to emit detected PII
  };
  topics?: {
    allow?: string[];                 // if set, restrict to these
    block?: string[];                 // always refuse these
  };
  human_review?: {
    required?: boolean;               // output is always a draft until a human signs (Scribe/Nora model)
    roles?: string[];                 // who may sign (e.g. ["doctor"])
  };
  limits?: {
    max_output_tokens?: number;
    max_turns?: number;
  };
  escalation?: {
    on: ("low_confidence" | "explicit_request" | "blocked_topic")[];
    action_tool_id?: string;          // a `handoff` tool to invoke
  };
  refusal_message?: string;           // shown when a guardrail blocks
}
```

This directly models what the code already does informally: `scribe.js` enforces human-in-the-loop ("You draft; a licensed clinician reviews and signs") — that becomes `human_review: { required: true, roles: ["doctor"] }`.

---

## 6. `Channel[]` — defined shape

```ts
type ChannelType = "web_widget" | "whatsapp" | "voice" | "email" | "api";

interface Channel {
  type: ChannelType;
  enabled: boolean;
  config: Record<string, unknown>;   // per-type (widget theme, phone number ref, etc.)
}
```

Channels are what "deploy an agent" produces for the customer. For an on-prem `runtime_target`, channel endpoints resolve on the customer side; only metadata about them flows back to the dashboard.

---

## 7. Versioning & lifecycle

The build→deploy seam requires that **a deployed agent cannot silently mutate**. Today `update()` overwrites the row, which breaks that guarantee.

**Recommended model — "current draft + published snapshots":**
- `agent_definitions` continues to hold the **working draft** (one row per `(tenant_id, key)`), edited freely.
- A new **`agent_spec_versions`** table stores an **immutable JSONB snapshot** each time a draft is *published* (`version` increments).
- A **deployment** references a specific `(agent_key, version)`. Editing the draft and re-publishing produces `version+1`; existing deployments keep running the version they reference until explicitly rolled forward.

Lifecycle: `draft → published → deployed → (disabled)`. `disabled` replaces `enabled = false`.

This is the smallest change that gives immutability, rollback, and an audit trail without rewriting the current model — the draft path stays as-is; publish/deploy are additive.

---

## 8. Normative machine-readable schema

The following are the **source of truth**. Both the builder (write path) and the runtime (read path) validate against them. Recommended home: a shared module `packages/core/src/spec/agentSpec.*` so RachDev and the runtime import the same definition.

### 8.1 TypeScript interface

```ts
export interface AgentSpec {
  spec_version: "1.0";
  id: number;
  tenant_id: number | null;
  key: string;
  template_ref: { slug: string; version: number } | null;
  industry: string | null;
  name: string;
  role: string;
  description: string;

  prompt: string;
  model_policy: { class: "fast" | "balanced" | "reasoning"; pin?: string };
  tools: Tool[];
  guardrails: Guardrails;
  knowledge: { sources: KnowledgeSource[] } | null;

  channels: Channel[];
  runtime_target: { type: "rachbase" | "onprem" | "byoc"; ref?: string };

  status: "draft" | "published" | "deployed" | "disabled";
  version: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  created_by: number | null;
}
// Tool, Guardrails, Channel, KnowledgeSource as defined in §4–§6.
```

### 8.2 JSON Schema (draft 2020-12, abbreviated to required core)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://rachdev.com/schemas/agent-spec/1.0.json",
  "title": "AgentSpec",
  "type": "object",
  "required": ["spec_version", "key", "name", "model_policy", "status", "version"],
  "additionalProperties": false,
  "properties": {
    "spec_version": { "const": "1.0" },
    "id": { "type": "integer" },
    "tenant_id": { "type": ["integer", "null"] },
    "key": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]{0,63}$" },
    "template_ref": {
      "type": ["object", "null"],
      "required": ["slug", "version"],
      "properties": { "slug": { "type": "string" }, "version": { "type": "integer" } }
    },
    "industry": { "type": ["string", "null"] },
    "name": { "type": "string", "minLength": 1 },
    "role": { "type": "string" },
    "description": { "type": "string" },
    "prompt": { "type": "string" },
    "model_policy": {
      "type": "object",
      "required": ["class"],
      "properties": {
        "class": { "enum": ["fast", "balanced", "reasoning"] },
        "pin": { "type": "string" }
      }
    },
    "tools": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "name", "enabled", "config"],
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["http_action", "knowledge_base", "handoff", "function"] },
          "name": { "type": "string" },
          "enabled": { "type": "boolean" },
          "config": { "type": "object" }
        }
      }
    },
    "guardrails": { "type": "object" },
    "knowledge": { "type": ["object", "null"] },
    "channels": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "enabled", "config"],
        "properties": {
          "type": { "enum": ["web_widget", "whatsapp", "voice", "email", "api"] },
          "enabled": { "type": "boolean" },
          "config": { "type": "object" }
        }
      }
    },
    "runtime_target": {
      "type": "object",
      "required": ["type"],
      "properties": {
        "type": { "enum": ["rachbase", "onprem", "byoc"] },
        "ref": { "type": "string" }
      }
    },
    "status": { "enum": ["draft", "published", "deployed", "disabled"] },
    "version": { "type": "integer", "minimum": 1 },
    "published_at": { "type": ["string", "null"], "format": "date-time" },
    "created_by": { "type": ["integer", "null"] }
  }
}
```

---

## 9. Adoption plan (not yet applied)

Additive and back-compatible with the current row shape:

1. **Migration `049_agentspec_v1.sql`**
   - Add columns to `agent_definitions`: `spec_version TEXT DEFAULT '1.0'`, `template_slug TEXT`, `template_version INT`, `industry TEXT`, `description TEXT`, `model_class TEXT`, `channels JSONB DEFAULT '[]'`, `runtime_target JSONB DEFAULT '{"type":"rachbase"}'`, `status TEXT DEFAULT 'draft'`, `version INT DEFAULT 1`, `published_at TIMESTAMPTZ`, `created_by INT`.
   - Backfill `status` from `enabled` (`enabled ⇒ 'published'`), then keep `enabled` as a generated/deprecated mirror for one release.
   - Create `agent_spec_versions (id, tenant_id, agent_key, version, spec JSONB, published_at, created_by)`.
2. **Shared schema module** `packages/core/src/spec/agentSpec.{js,d.ts,schema.json}` — the §8 artifacts, exported from `@rach/core`.
3. **Validator** — a `validateAgentSpec(spec)` in `@rach/core` (Ajv over the JSON Schema). Wire into `createDefinition`/`updateDefinition` so the API rejects malformed specs. **Behavior change** — gate behind the migration and communicate that previously-accepted free-form payloads may now fail.
4. **Publish/deploy endpoints** — `POST /definitions/:id/publish` (snapshot → `agent_spec_versions`, bump `version`) and deploy referencing a version. (Overlaps migration step #5, the runtime contract.)
5. **Model policy** — extend `@rach/llm` `resolveModel` to accept a `class` and map it per environment; keep `pin`/raw id for back-compat.

---

## 10. Decisions (settled 2026-08-05)

1. **Versioning model** — ✅ **Adopt "draft + immutable published versions"** (§7). `agent_definitions` holds the working draft; `agent_spec_versions` stores an immutable JSONB snapshot per publish; deployments reference a specific `(agent_key, version)`.
2. **Model addressing** — ✅ **`model_policy.class` abstraction.** Specs carry `class` (`fast`/`balanced`/`reasoning`) + optional `pin`; `@rach/llm` resolves to a concrete model per environment. Raw `provider`/`model` are dropped from the spec.
3. **Validator strictness** — ✅ **Reject unknown fields** (`additionalProperties: false`) from launch. Existing free-form rows are normalized by the migration before the validator is wired in.
4. **Template unification** — ✅ **Keep `Template` as a separate catalog schema** linked by `template_ref`. Platform templates are not folded into `agent_definitions`.
5. **Tool registry v1** — ✅ **The four tool types are the set:** `http_action`, `knowledge_base`, `handoff`, `function`. No `database_query` in v1 (reachable via `http_action` for now).

**Implementation order (unblocked):** migration `049_agentspec_v1.sql` (+ `agent_spec_versions`) → shared `packages/core/src/spec/agentSpec.{js,d.ts,schema.json}` → `validateAgentSpec` (Ajv) wired into `createDefinition`/`updateDefinition` → publish endpoint (`POST /definitions/:id/publish`) → `@rach/llm` `model_policy.class` resolution. Runtime contract (deploy against a published version) follows as migration step #5.

---

## 11. Implementation status (2026-08-05)

**Done and verified (code, not yet migrated in any live DB):**
- `049_agentspec_v1.sql` — new columns + normalization + `agent_spec_versions`.
- `packages/core/src/spec/agentSpec.{js,d.ts,schema.json}` — normative schema + Ajv validators (`validateAgentSpec`, `validateAgentSpecInput`), `rowToSpec`, `columnsFromInput`. Exported as `require('@rach/core').agentSpec`. `ajv`/`ajv-formats` added to `@rach/core` deps.
- `AgentDefinition` model — new columns in create/update; atomic `publish()` (snapshot → `agent_spec_versions`, bump version); `listVersions`/`getVersion`.
- `@rach/llm` — `MODEL_CLASSES` + `modelForPolicy`; `gateway.chat` accepts `modelPolicy`. On-prem remaps classes via `LLM_CLASS_FAST|BALANCED|REASONING`.
- Controller/routes — create/update validate input (422 on invalid; unknown fields rejected); `POST /definitions/:id/publish` and `GET /definitions/:id/versions` added.
- Validator smoke-tested; all 35 backend unit tests still pass.

**To run in the target environment:** `npm run migrate` (applies 049), then a DB round-trip of create → publish → versions (can't be exercised in a Postgres-less sandbox).

**Known follow-ups (step 5 territory, intentionally not changed now):**
- `adminController` template CRUD still passes raw `req.body` (old shape: `enabled`, `provider`) — it no longer errors, but `enabled` is now a no-op (use `status`) and `provider` is ignored. Migrate it onto the same validator + `columnsFromInput`.
- `scribe.js` and `agentMonitorController` still read the legacy `model` column directly; they keep working (falling back to the gateway default) but should move to `model_policy` when the runtime consumes published specs.
- The legacy `enabled`/`provider` columns are kept for one release; drop after callers migrate.
