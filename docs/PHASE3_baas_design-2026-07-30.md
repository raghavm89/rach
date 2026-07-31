# RachBase Phase 3 — BaaS Primitives Design

**Date:** 2026-07-30
**Scope:** Add the client-facing backend primitives — **Auth**, **Storage (S3)**, **Edge Functions**, and their shared **Runtime** — turning RachBase from a "run my app on a VM" PaaS into a "give my app's end-users backend primitives over an API" BaaS. Everything runs on the **tenant's own VM(s)**; horizontal scale is "attach another VM"; object storage is sold as add-on disk.
**Status:** Design only — captures the decisions from the Phase 3 design discussion. No implementation.
**Builds on:** `paas-on-vm-design-2026-07-26.md` (Caddy + systemd + per-VM SSH), `AUTHENTICATION.md` (`@rach/identity`), `PHASE2_implementation_plan.md` (tabbed IA, domains, Spike A ingress), `00_MASTER_ROADMAP.md`.

---

## 1. The reframe: the Project is the unit

Phase 1–2 built PaaS DNA: Caddy + systemd + per-VM SSH keys + native Postgres, with auth serving *RachBase's own platform users*. Phase 3 is a different shape — **BaaS** — where a tenant's *end-user application* calls RachBase primitives directly over HTTP.

None of the four primitives mean anything until there's a unit they hang off. That unit is the **Project**. Every primitive is addressed through one project ref behind a single gateway host:

```
https://<ref>.rachbase.app/auth/v1/*        → Auth      (native, @rach/identity-derived)
https://<ref>.rachbase.app/rest/v1/*        → Data      (PostgREST, MIT)
https://<ref>.rachbase.app/storage/v1/*     → Storage   (SeaweedFS + native policy layer)
https://<ref>.rachbase.app/functions/v1/*   → Functions (Deno isolate runtime, MIT)
```

Two project keys authorize callers:

- **`anon`** — public, shipped in client apps, policy-gated (row-level rules apply).
- **`service_role`** — server-side only, bypasses policy.

Both keys are themselves **JWTs signed by the project's own secret**. This is the load-bearing trick: the key *is* a verifiable token, so the gateway and Postgres verify caller identity with the same JWT machinery, no extra lookups. End-user session tokens issued by Auth are signed by the **same per-project secret**, carrying `sub` (user id) and `role`, so Postgres row-level policies read `auth.uid()` / `role` straight from the JWT.

**The project secret and Auth run on the tenant's VM** (see §3), so RachBase's control plane cannot mint a token to read tenant data — the security boundary is real, not nominal.

---

## 2. Decisions locked (from the design discussion)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Placement** | Everything runs on the **tenant's VM(s)** | Data-at-rest isolation / residency; matches existing per-VM grain |
| 2 | **Horizontal scale** | **Attach another VM** (head + worker topology, §4) | Reuses multi-VM-per-tenant model already in the schema |
| 3 | **Object storage disk** | Sold as an **add-on volume** (catalog item) | 50 GB root can't hold end-user uploads; disk is a natural upsell |
| 4 | **Auth** | **Build native**, derived from `@rach/identity`, multi-tenant, secret on the VM | Reuses hardened flows; keeps the secret local so the boundary is real |
| 5 | **Data/REST** | **Adopt PostgREST** (MIT) | Mature, tiny; re-implementing RLS-over-HTTP is wasted effort |
| 6 | **Storage engine** | **Adopt SeaweedFS** (Apache 2.0) — **not** MinIO/Garage | MinIO is AGPL + archived (2026); Garage is AGPL. SeaweedFS is Apache 2.0, maintained, scales by volume server |
| 7 | **Functions runtime** | **Adopt the Deno isolate runtime** (MIT); build only the control plane | Don't build an isolate sandbox; own the deploy/invoke/secrets layer |
| 8 | **Gateway** | **Extend Caddy** (already on every VM) | Already terminates TLS + routes by host |
| 9 | **Branding / legal** | **No "Supabase" naming anywhere; no AGPL components** | Permissive licenses (MIT/Apache) impose nothing on a hosted service; API-shape compatibility is not copyrightable |

**License note.** MIT (PostgREST, Deno) and Apache 2.0 (SeaweedFS, Caddy) obligate retaining license/NOTICE text only *in distributed source* — a hosted service distributes nothing to end-users, so nothing third-party-branded is ever user-facing. AGPL (MinIO, Garage) would obligate publishing the whole service's source and is therefore excluded.

---

## 3. Anatomy of a Project

A Project is a control-plane record plus a set of on-VM resources. **A `projects` table already exists** (migration 024: `id, tenant_id, name, slug`, with `environments` and `services` hanging off it) — Phase 3 **extends** that existing table rather than creating a new one, so the BaaS project *is* the project the tenant already sees. VMs are identified by the existing **`vm_id VARCHAR(50)`** PVE identifier (per `tenant_vm_assignments` / `deployment_services`), not an FK to a `vms` table.

```sql
-- Extend the existing projects table (migration 024)
ALTER TABLE projects
  ADD COLUMN ref            TEXT UNIQUE,        -- short public id → <ref>.rachbase.app
  ADD COLUMN jwt_secret_enc TEXT,               -- keyCrypto.seal(project JWT signing secret)
  ADD COLUMN head_vm_id     VARCHAR(50),        -- PVE vm_id of the control-plane VM
  ADD COLUMN baas_status    TEXT DEFAULT 'provisioning';  -- provisioning | live | paused | failed

CREATE TABLE project_keys (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,                 -- 'anon' | 'service_role'
  jwt         TEXT NOT NULL,                 -- long-lived JWT signed by the project secret
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

On creation the control plane: generates a `ref` and a random per-project JWT secret (sealed with `RACHBASE_KEY_ENC_SECRET`, the same envelope already used for VM keys); mints the `anon` and `service_role` JWTs; provisions the on-VM resources (Postgres database, Auth process, gateway route) on the project's **head VM**; and writes the `<ref>.rachbase.app` ingress route.

**The secret lives in two places only:** sealed in the control-plane DB (for key re-mint / rotation) and in an `EnvironmentFile` on the head VM (mode 600) that the on-VM Auth + gateway read. It is never sent to a client and never leaves the tenant's VM at request time.

---

## 4. Multi-VM topology — head + workers

A project starts on one VM. When a tenant outgrows it, they **attach another VM** and it joins as a worker. What each role runs:

```
                     Internet
                        │  <ref>.rachbase.app  (stable ingress — Spike A)
                        ▼
        ┌──────────── HEAD VM (control plane) ─────────────┐
        │  Caddy gateway  (TLS, key auth, route by path)   │
        │  Auth           (native, holds project secret)   │
        │  PostgREST      → primary Postgres               │
        │  Primary Postgres (project data, RLS)            │
        └──────────────┬───────────────────────────────────┘
                       │  private network (WireGuard)
          ┌────────────┼─────────────────────┐
          ▼            ▼                       ▼
   WORKER VM #1   WORKER VM #2           WORKER VM #3
   Deno function  SeaweedFS volume       Postgres read
   isolate pool   server (S3 disk)       replica / other
                                         project's DB
```

- **Head VM** — the control plane: gateway, Auth (+ the project secret), primary Postgres, PostgREST. One per project.
- **Worker VMs** — capacity: function isolate pools, SeaweedFS volume servers (the add-on disk), extra app instances, Postgres read replicas.

**What "attach a VM" actually scales:**

| Primitive | Scales horizontally? | Mechanism |
|---|---|---|
| Functions (Deno) | Yes — stateless | More isolate workers on the new VM; gateway load-balances |
| Storage (SeaweedFS) | Yes — by design | New volume server = more disk + throughput (= the disk upsell) |
| App / web services | Yes | More instances behind the gateway |
| Auth / gateway / PostgREST | Replicable, but bounded by the primary DB they read | Stateless replicas; refresh tokens live in the primary DB |
| **Postgres (writes)** | **No — single primary** | Scale by: bigger VM (vertical), read replicas, or **placing different projects' DBs on different VMs** |

**DB scaling policy:** horizontal DB scaling = *spread projects across VMs* (a project's Postgres targets a `vm_id`, already supported by `deployment_services`). One busy project's write capacity is capped at its head VM — levers are vertical resize and read replicas. Accepted for v1: the many-small-projects shape fits shard-by-project.

**Two hard prerequisites the moment a tenant has >1 VM:**

1. **Stable ingress that routes project → head VM** — this is Phase 2's open **Spike A**. `<ref>.rachbase.app` must land on the right head VM and survive VM replacement. Shape: a stable edge (ingress VM/LB with a fixed IP) terminating TLS and routing by `Host`.
2. **Private network between the tenant's VMs** (WireGuard/VPC) so a worker's functions reach the primary Postgres and SeaweedFS volume servers reach their master. The project secret is distributed to any VM running Auth/gateway.

---

## 5. API gateway & routing

Caddy on the head VM is extended from "reverse-proxy by host" to a **project API gateway**. Per request it:

1. Terminates TLS for `<ref>.rachbase.app` (+ custom domains, Phase 2 machinery).
2. Reads the **`apikey`** header (or `Authorization: Bearer`) and verifies it against the project secret. Rejects unsigned/foreign keys at the edge.
3. Routes by path prefix to the local upstream: `/auth/v1→` Auth, `/rest/v1→` PostgREST, `/storage/v1→` storage policy service, `/functions/v1→` function router.
4. Passes the verified JWT downstream unchanged; PostgREST and the storage policy layer read `sub`/`role` claims for row/object rules.

Enforced at the gateway, uniformly: per-project **rate limits**, request-size caps, and CORS (per-project allowed origins). Implementation choice — Caddy with a small auth/route plugin, or a thin native Node/Go gateway process fronted by Caddy for TLS (see open decision D1).

---

## 6. Auth (native, `@rach/identity`-derived)

Reuse the hardened flows from `@rach/identity` (two-phase OTP signup, OAuth with CSRF `state`, refresh-token rotation with family reuse detection, hashed reset tokens, uniform login timing) — but make them **project-scoped**:

- **Per-project user tables** — each project's Postgres owns its own `auth.users`, `auth.refresh_tokens`, `auth.identities`, `auth.oauth_states`. No cross-project user commingling.
- **Per-project JWT secret** — end-user access tokens are signed with the project secret (not the platform `JWT_ACCESS_SECRET`), so they validate against the same key the gateway and RLS use.
- **Per-project provider config** — OAuth client IDs/secrets, allowed redirect URLs, email templates configured per project.
- **Claims** — access token carries `sub`, `email`, `role` (default `authenticated`), `aud`; refresh token stays an opaque, hashed, HttpOnly-cookie value with rotation.

Runs as a light process on the head VM (~50 MB), reading the project secret from the on-VM env file. Because the secret never leaves the VM, RachBase's central control plane cannot mint end-user tokens.

**API surface (`/auth/v1/*`):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/signup` | anon | Email+password signup → OTP (two-phase, reuses pending-registration flow) |
| POST | `/verify` | anon | Confirm OTP → create user + session |
| POST | `/token?grant_type=password` | anon | Password login → access + refresh |
| POST | `/token?grant_type=refresh_token` | refresh cookie | Rotate → new access token |
| GET | `/user` | user JWT | Current user profile |
| PUT | `/user` | user JWT | Update profile / password |
| POST | `/logout` | user JWT | Revoke current session |
| POST | `/recover` | anon | Email password-reset link |
| GET | `/authorize?provider=` | anon | Begin OAuth (Google/GitHub) |
| GET | `/callback` | — | Complete OAuth → session |
| — | `/admin/users*` | service_role | List/create/delete/ban users (admin API) |

---

## 7. Storage (SeaweedFS + native policy layer)

Two layers: **SeaweedFS** (Apache 2.0) holds the bytes and provides the S3-compatible engine; a **native policy service** fronts it to tie every object operation to an Auth JWT.

- **Engine** — SeaweedFS master + volume servers. Volume servers run on **worker VMs backed by the add-on disk** (catalog item). Adding disk/throughput = adding a volume server = the horizontal-scale + upsell story in one mechanism.
- **Policy layer** (native, ~100 MB) — validates the JWT, applies bucket/prefix rules (e.g. authenticated users may write only under `user-<sub>/…`), issues time-limited **signed URLs**, and enforces size/content-type limits. Buckets are `public` or `private`; private objects require a valid JWT or signed URL.
- **Data** — bucket + object metadata (owner, content-type, size, visibility) in the project Postgres; bytes in SeaweedFS. Policies stored per bucket.

**API surface (`/storage/v1/*`), S3-compatible verbs:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/bucket` | service_role | Create bucket (public/private) |
| GET | `/bucket` | service_role | List buckets |
| POST | `/object/<bucket>/<key>` | user JWT / policy | Upload (multipart; resumable for large files) |
| GET | `/object/<bucket>/<key>` | JWT / signed URL | Download |
| DELETE | `/object/<bucket>/<key>` | user JWT / policy | Delete |
| POST | `/object/sign/<bucket>/<key>` | user JWT | Mint a time-limited signed URL |
| GET | `/object/list/<bucket>` | user JWT / policy | List objects under a prefix |

---

## 8. Edge Functions + Runtime (Deno isolates)

**Runtime** = the Deno isolate host (MIT); **Functions** = the control plane RachBase builds around it. Isolates give per-request sandboxing and fast cold start; RachBase builds only deploy, invoke, secrets, and logs.

- **Deploy** — tenant pushes a bundle (TypeScript/JS). The control plane stores it (in SeaweedFS or on-VM), records a version, and makes it available to the isolate pool on the head/worker VMs.
- **Invoke** — `POST/GET /functions/v1/<name>` hits the gateway → function router → a warm isolate. The invocation receives the caller's JWT (functions can call `/rest`, `/storage`, or the DB as the user or with `service_role`).
- **Secrets** — per-function env vars, sealed with `keyCrypto`, decrypted into the isolate at cold start (reuses the Phase-2 Variables mechanism).
- **Scale** — stateless; add a worker VM to grow the isolate pool. Idle functions scale to zero (isolates spin down).
- **Runtime unification** — long-running container/CaaS workloads (roadmap Stage 6) target the *same* runtime abstraction as short-lived isolates: isolates for request/response functions, systemd/containers for long-lived services. One control plane, two execution modes.

**API surface (`/functions/v1/*` + control):**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/deploy/<name>` | service_role | Upload a function bundle → new version |
| GET/POST | `/functions/v1/<name>` | anon / user JWT | Invoke |
| GET | `/logs/<name>` | service_role | Tail invocation logs |
| PUT | `/secrets/<name>` | service_role | Set per-function secrets (sealed) |
| DELETE | `/deploy/<name>` | service_role | Remove a function |

---

## 9. Data / REST (PostgREST)

The implicit fifth primitive and the reason the JWT design pays off. **PostgREST** (MIT) exposes the project's Postgres schema as REST at `/rest/v1/*`. It reads the JWT `role`/`sub` claims and runs every query under Postgres **row-level security**, so the `anon` key sees only what RLS permits and end-user tokens see only their own rows. No custom data API to build; the security model is Postgres RLS, which the whole key/JWT design feeds.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/rest/v1/<table>?<filters>` | anon / user JWT | Select (RLS-gated) |
| POST | `/rest/v1/<table>` | user JWT | Insert |
| PATCH | `/rest/v1/<table>?<filter>` | user JWT | Update |
| DELETE | `/rest/v1/<table>?<filter>` | user JWT | Delete |
| POST | `/rest/v1/rpc/<fn>` | anon / user JWT | Call a Postgres function |

---

## 10. Control-plane data model — summary of changes

| Object | Change |
|---|---|
| `projects` (**extend** migration 024) | add ref, sealed JWT secret, `head_vm_id VARCHAR(50)`, baas_status (§3). Reuses the existing project → environments → services hierarchy |
| `project_keys` (new) | anon + service_role JWTs per project (§3) |
| `project_vms` (new) | project → `vm_id VARCHAR(50)` membership + role (`head` \| `worker`) + subrole (`functions`\|`storage`\|`replica`). Aligns with `tenant_vm_assignments` |
| `project_functions` (new) | function name, current version, bundle ref, sealed secrets |
| `storage_buckets` (new) | per-project buckets, visibility, policy JSON |
| `deployment_domains` | reused for `<ref>.rachbase.app` + custom domains (Phase 2) |
| On-VM (per project) | Postgres DB; Auth env file (`/etc/rachbase/<ref>.auth.env`, 600); Caddy route snippet; systemd units for Auth / PostgREST / function pool; SeaweedFS on worker |

Reuses existing infra: `keyCrypto` envelope encryption (`RACHBASE_KEY_ENC_SECRET`), per-VM SSH keys, `runDeploy` orchestration, Caddy manager, catalog/billing.

---

## 11. Security model

- **Real data boundary** — project secret + Auth live on the tenant VM; the control plane cannot mint end-user tokens for tenant data.
- **Key auth at the edge** — foreign/unsigned keys rejected at the gateway before reaching any upstream.
- **RLS everywhere** — `/rest` and policy checks derive from Postgres row-level security keyed on JWT claims; `anon` is least-privilege by default, `service_role` is server-side only and never shipped to clients.
- **Storage** — private by default; object access requires a valid JWT or signed URL; prefix rules scope users to their own paths.
- **Secrets at rest** — project JWT secret and function/env secrets sealed with `keyCrypto`; on-VM env files mode 600; never logged.
- **Tenant isolation** — every project/VM/bucket/function row is tenant-scoped; VM-ownership guard (Phase 2 audit T1) and deploy rate-limit (T6) reused.
- **Fleet patch velocity is now a security control** — distributed on-VM services mean a critical Auth/gateway CVE must be pushed to every tenant VM. Build the fleet-update mechanism (versioned agent, staged rollout, "N VMs behind" dashboard) as a first-class Phase 3 deliverable, not an afterthought.

---

## 12. Billing / catalog integration

Reuses the Phase-1 shared catalog + purchase service (server-priced, signature-verified):

- **Add-on disk (Storage)** — a `storage_volume` catalog item; purchase provisions a SeaweedFS volume server on a worker VM with the bought capacity.
- **Additional VM (scale-out)** — a VM catalog item that joins the project as a worker (functions / storage / replica role).
- **Project tier** — optionally meter projects, function invocations, or storage GB; all money paths already funnel through the shared purchase service (integer-cents, invoices, tax engine from Phase 1).

---

## 13. Phased roadmap (each slice ships on its own)

1. **Foundation — project model + gateway + keys.** `projects`/`project_keys`, per-project JWT secret (sealed + on-VM), Caddy extended to verify keys and route by path, `<ref>.rachbase.app` provisioning. Nothing else works without this.
2. **Auth (native, project-scoped).** Fork `@rach/identity` flows to per-project user tables + per-project secret on the head VM. Ship `/auth/v1/*`.
3. **Data/REST.** Stand up PostgREST against the project DB with RLS; ship `/rest/v1/*`. (Cheap once §1–2 exist — the keys/claims already feed it.)
4. **Storage.** SeaweedFS volume server on add-on disk + native policy layer + signed URLs; ship `/storage/v1/*`. Wire the `storage_volume` catalog item.
5. **Edge Functions + Runtime.** Deno isolate pool + deploy/invoke/secrets/logs control plane; ship `/functions/v1/*`. Most net-new runtime work — last.
6. **Multi-VM scale-out.** Stable ingress (Spike A), private network (WireGuard), worker roles, read replicas, and the **fleet-update mechanism** (§11).

Dependency order: 1 → 2 → {3, 4} → 5; 6 lands alongside once a second VM is needed. Feature-flag each slice (Phase-2 convention).

---

## 14. Open decisions

| # | Decision | Options | Lean |
|---|---|---|---|
| D1 | Gateway implementation | Caddy + auth/route plugin **vs** thin native Node/Go gateway behind Caddy-for-TLS | Native gateway behind Caddy — more control over key verification + per-project rate limits |
| D2 | Single-project scale-out shape | One head VM + workers **vs** allow multiple heads (project sharded across heads) | One head per project for v1; multi-head only if a single project needs it |
| D3 | Function bundle store | SeaweedFS **vs** on-VM disk **vs** control-plane object store | SeaweedFS if Storage ships first; else on-VM |
| D4 | Read-replica automation | Manual add **vs** auto-provision on load | Manual for v1 |
| D5 | Stable ingress form (Spike A) | Dedicated ingress VM (fixed IP + Caddy) **vs** cloud LB (anycast) | Resolve before multi-VM; blocks slice 6 |
| D6 | Custom-domain-per-project | Reuse Phase-2 `deployment_domains` as-is **vs** extend for project refs | Reuse; extend only if needed |
| D7 | Rate-limit / quota granularity | Per-project only **vs** per-key / per-endpoint | Per-project at launch; refine later |

**Only hard prerequisite for the multi-VM slice:** resolve Spike A (D5). Everything in slices 1–5 runs on a single head VM and needs nothing new externally beyond the GoDaddy DNS automation already designed in Phase 2.
