# Tenant Dashboard Audit — Security + Code Review

**Date:** 2026-07-22
**Scope:** Rachbase **tenant_admin + tenant_user** dashboard. Frontend (`rachbase-web`) tenant pages + the backend endpoints they call.
**Type:** Security review + code review. Primary theme: **cross-tenant isolation** and the **tenant_admin ↔ tenant_user boundary**.

## Surface reviewed

Frontend: `vm-monitor`, `my-vms`, `deployment`, `orders`, `billing`, `credit-usage`, `users`, `profile`, SSH terminal.
Backend: `monitoring/*` (scoped), `expansion/*` (orders/custom/subscriptions/cancel/my-requests), `deployment/*` (GitHub, services, deploy), `projects/*` (units), `users` + `:id/vms`, agent credits, cart, terminal; `@rach/deploy` `deployRunner`.

## Summary

Tenant isolation is **mostly enforced** and, thanks to earlier fixes, the monitoring and terminal paths are solid: monitoring scope re-validates VM IDs and (post admin-audit A2) tenant-scopes assignments; the terminal's `resolveVmAccess` checks the VM's tenant and role. User management, VM assignment, order listing, and subscription cancellation are all tenant-scoped.

The **one serious hole** is in the deployment path: a `tenant_admin` can create a deployment service pointing at **another tenant's `vm_id`**, and the deploy runner resolves the SSH target by `vm_id` alone — so a deploy runs on another tenant's VM. There's also an intra-tenant privilege gap (any `tenant_user` can cancel the tenant's orders) and the same `vm_id` validation gap in the (currently hidden) projects path.

Counts: **High 1**, **Medium 2**, **Low 3**, **Info/quality 2**.

---

## Update — 2026-07-22: fixes implemented

| ID | Status | Change |
|----|--------|--------|
| T1 | Fixed | New `lib/tenantVms.vmBelongsToTenant` helper. `deploymentController.createService` rejects VMs not owned by the caller's tenant (403). `runDeploy` now joins `vm_ssh_config` on **both** `vm_id` and `tenant_id`, so a cross-tenant pairing resolves no SSH target (defence-in-depth). |
| T2 | Fixed | `cancelMySubscription` requires `requested_by = caller.id` for `tenant_user`; `tenant_admin` keeps tenant-wide cancel. |
| T3 | Fixed | `projectController.createService` validates VM ownership when a `vm_id` is supplied (same helper). |
| T4 | Fixed | `credit-usage` page gained a tenant-admin role guard. (Agent-credit endpoints are served by **rachdev-backend**, not rachbase, and the `agent_credits` table is tenant-keyed — out of this app's scope; flagged for the rachdev audit.) |
| T5 | Fixed | `my-vms` page gained a tenant_user/developer role guard. |
| T6 | Fixed | New `deployLimiter` (20 / 5 min / user) applied to `POST /api/deployment/services/:id/deploy`. |
| T7 | Fixed | Folded into T1 fix #2 (the `runDeploy` tenant-join). |
| T8 | No action | Tenant pages already use real, scoped data. |

---

## High

### T1 — Cross-tenant deploy: `createService` doesn't validate VM ownership
**Where:** `deploymentController.createService` (`POST /api/deployment/services`, `tenant_admin`); `@rach/deploy` `deployRunner.runDeploy`.

`createService` scopes the new `deployment_services` row to the caller's tenant but takes `vm_id` **straight from the request body with no check that the VM belongs to that tenant**. Then `runDeploy` resolves the SSH target purely by id:

```sql
-- deployRunner.js
LEFT JOIN vm_ssh_config v ON v.vm_id = s.vm_id   -- no tenant match
```

So the chain is: a `tenant_admin` (with GitHub connected) creates a service with **Tenant B's `vm_id`** (e.g. `qemu/301`, low-entropy) → calls `POST /services/:id/deploy` (which only checks the service is in *their* tenant) → `runDeploy` SSHes into **Tenant B's VM** using B's `vm_ssh_config` and runs the deploy (git clone of A's repo, build, run) as the SSH user. That's **cross-tenant code execution** — one tenant deploying arbitrary code onto another tenant's machine.

**Fix (two layers):**
1. In `createService`, validate that `vm_id` belongs to the caller's tenant before insert — reuse the pool/assignment check `vmAssignmentController.assignVMs` already uses (`tenant_vm_assignments` for explicit tenants, `pve_pool` membership otherwise). Reject otherwise.
2. Defence-in-depth in `runDeploy`: join `vm_ssh_config` on **both** `vm_id` and `tenant_id` (`v.tenant_id = s.tenant_id`), so a mismatched pairing can never resolve an SSH target.

---

## Medium

### T2 — Any `tenant_user` can cancel the whole tenant's orders
**Where:** `expansionController.cancelMySubscription` (`PATCH /api/expansion/requests/:id/cancel-my`, `tenant_admin` + `tenant_user`).

The lookup is scoped by `tenant_id` only, **not** `requested_by`:

```sql
WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('cancelled')
```

So a `tenant_user` can cancel any order in their tenant — including the `tenant_admin`'s subscription. There's no cross-tenant leak (tenant-scoped), but it breaks the intra-tenant role boundary: a low-privilege user can cancel billing they didn't create.

**Fix:** For `tenant_user`, additionally require `requested_by = caller.id`; keep the tenant-wide scope for `tenant_admin`.

### T3 — Projects `createService` has the same unvalidated `vm_id` (currently hidden)
**Where:** `projectController.createService` (`POST /api/projects/:id/services`, `tenant_admin` + `developer`).

The project is correctly tenant-scoped (`Project.findScoped(id, tenant_id)`), but `vm_id` / `compute_target` come from the body **unvalidated** — the same class as T1. If the project deploy path SSHes by `vm_id`, it carries the same cross-tenant risk. Exposure is currently reduced because the Projects nav is hidden, but the endpoints remain mounted.

**Fix:** Validate `vm_id` ownership (same helper as T1) when a VM compute target is supplied; or block VM targets on this path until it's re-enabled.

---

## Low

### T4 — `credit-usage` page has no client-side role guard
`app/dashboard/credit-usage/page.tsx` has no `role`/redirect guard (unlike `vm-monitor`, `billing`, `orders`). A non-`tenant_admin` navigating directly renders the page shell. The backend must enforce it — **verify the agent-credit endpoints scope by the JWT `tenant_id`** (the `agent_credits` table is tenant-keyed, so as long as `tenant_id` comes from the token this is safe). Add the guard for consistency.

### T5 — `my-vms` has no client-side role guard
`app/dashboard/my-vms/page.tsx` has no role guard. It only renders the caller's own (scoped) VMs, so exposure is benign, but add the guard for consistency with the other tenant pages.

### T6 — No rate limiting on deploy triggers
`POST /api/deployment/services/:id/deploy` (and the units checkout/verify flows) have no per-tenant rate limiting; a tenant could spam deploys. Low, but worth a limiter given each triggers SSH + build work.

---

## Info / code quality

### T7 — `runDeploy` is the shared choke point — harden it once
Both the webhook path and the manual trigger flow through `runDeploy`, which trusts the service's `vm_id`. Adding the `tenant_id` join there (T1 fix #2) protects every caller at once and is the highest-leverage single change.

### T8 — Tenant pages use real data (good)
No mock data is wired into the tenant pages; they all read from the scoped APIs with the JWT. Role guards are UX-only (server-side `authorize()` is the real boundary) — same accepted model noted in the admin audit.

---

## What's already good (no action)

- Monitoring scope re-validates VM IDs and tenant-scopes `tenant_user` assignments (H1 + admin-audit A2). Terminal `resolveVmAccess` enforces admin/tenant_admin/tenant_user correctly.
- `myExpansionRequests` scopes correctly (tenant_admin → tenant, tenant_user → own).
- `vmAssignment` `assignVMs`/`removeVM` check tenant membership and validate VM IDs; `users` management is tenant-scoped and blocks escalation to `admin`.
- `cancelMySubscription`, `getDeployLogs`, `triggerDeploy`, `listServices` are all tenant-scoped (no cross-tenant leak).

## Suggested priority order

1. **T1** — validate VM ownership in `createService` + tenant-join in `runDeploy` (cross-tenant RCE).
2. **T2** — scope `cancelMySubscription` to the caller for `tenant_user`.
3. **T3** — same VM-ownership validation on the projects path.
4. **T4/T5** — add the missing client-side role guards; verify credit endpoints are JWT-tenant-scoped.
5. **T6** — rate-limit deploy triggers.
