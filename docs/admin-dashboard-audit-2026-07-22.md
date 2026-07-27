# Admin Dashboard Audit — Security + Code Review

**Date:** 2026-07-22
**Scope:** Rachbase **admin role only** (excludes tenant_admin / tenant_user features). Frontend (`rachbase-web`) admin pages + the admin-only backend endpoints they call.
**Type:** Security review + code correctness review.

## Surface reviewed

Frontend: `dashboard/page.tsx` (Overview), `tenants/page.tsx`, `users/page.tsx`, `infrastructure/page.tsx`, `orders/page.tsx`, `monitoring/page.tsx`.
Backend: `tenantController`, `@rach/identity` `userController` + `routes/users.js`, `planController`, `deploymentController` (`vm-ssh-config`), `expansionController` (admin: packages, requests, observability), `vmKeyController`, `routes/*` authorization.

## Summary

The admin plane has a **solid authorization baseline**: every admin route is gated with `authorize('admin')` (or `admin`/`tenant_admin` where intended), the user model returns `SAFE_FIELDS` (no `password_hash` leakage), `tenant_admin` cannot create or escalate to `admin`, and self-role-change / self-delete are blocked. Because `admin` is a fully-trusted role, most "admin can act on any tenant" behaviour is by design, not a vulnerability.

The findings below are therefore mostly about **operational safety, tenant-isolation side effects, and input validation** rather than direct privilege escalation. The two that matter most both interact with data lifecycle: **deleting a tenant silently destroys the VM private keys** (orphaning real VMs), and **moving/removing a user between tenants leaves stale VM assignments** that leak monitoring metrics cross-tenant.

Counts: **Medium 3**, **Low 4**, **Info/quality 3**.

---

## Update — 2026-07-22: fixes implemented

| ID | Status | Change |
|----|--------|--------|
| A1 | Fixed | Tenants now **soft-delete** (migration `033`, `deleted_at`). `deleteTenant` requires an explicit name confirmation, marks the tenant deleted (no cascade), **revokes** its `vm_keys`, detaches its users, and **emails ARKA** (`sendTenantTeardownEmail`) to de-provision — nothing is silently destroyed. Listings filter `deleted_at IS NULL`. |
| A2 | Fixed | `updateUserTenant` clears `user_vm_assignments` on any tenant change; the monitoring `tenant_user` scope now intersects assignments with the tenant's VMs (explicit mode), so stale assignments can't leak cross-tenant metrics. |
| A3 | Fixed | `updateUserRole` / `deleteUser` refuse to demote or delete the last remaining `admin` (`wouldRemoveLastAdmin`). |
| A4 | Fixed | `setVmSshConfig` validates `vm_id` (VMID_RE), `ip_address`, `ssh_port` (1–65535), `ssh_user`, and verifies the tenant exists. Kept as an edit-IP path (see A5). |
| A5 | Fixed | Infrastructure page gained an admin **role guard** and was **repurposed** as the key-activation UI: Pending Keys (activate → link vm_id/IP/port), Active VM Access (edit IP, break-glass reissue). |
| A6 | Fixed | `createUser` enforces password ≥ 8 chars and validates email format. |
| A7 | Fixed | `assignObs` validates `vm_id` format. |
| A10 | Fixed | `setVmSshConfig` default `ssh_user` is now `rachops` (not `root`). |

**Migration required:** run `node packages/core/src/db/migrate.js` to apply `033_tenant_soft_delete.sql`.

Deferred: A8 (client guards are UX-only — accepted), A9 (getUserById self-view type nit).

---

## Medium

### A1 — Deleting a tenant cascades away VM keys + SSH config, orphaning real VMs
**Where:** `tenantController.deleteTenant`; FKs in migrations `021_vm_ssh.sql`, `032_vm_keys.sql`, `020_deployment.sql`, `013_vm_observability.sql`.

`DELETE FROM tenants WHERE id = $1` relies on FK cascade. `users.tenant_id` is `ON DELETE SET NULL` (users survive), but `vm_keys`, `vm_ssh_config`, `deployment_services`, `vm_observability_assignments`, and `agent_credits` are all `ON DELETE CASCADE`. So deleting a tenant **irrecoverably destroys the encrypted private keys** (`vm_keys`) and SSH configs for VMs that ARKA still runs with the installed public keys. Those VMs become **unreachable** (no private key, no config) and can only be recovered via ARKA re-install. There is no confirmation, archival, or de-provisioning step — a single admin click can strand a tenant's whole fleet and lose the keys.

**Fix:** Before allowing tenant deletion, either (a) block while the tenant has active VMs/keys and require explicit de-provisioning first, or (b) run a teardown that revokes keys, triggers ARKA de-provisioning, and archives records — rather than a silent cascade. At minimum, soft-delete tenants and require a two-step confirm.

### A2 — Stale `user_vm_assignments` after a tenant move → cross-tenant metric leak
**Where:** `userController.updateUserTenant`; monitoring `resolveScope` (`controllers/monitoringController.js`).

`updateUserTenant` changes `users.tenant_id` but leaves `user_vm_assignments` untouched. The monitoring `tenant_user` scope builds its PromQL filter **directly from `user_vm_assignments`** and does **not** verify each VM's current tenant. So a user moved to a different tenant (or removed from one — `tenant_id → null`) keeps seeing **metrics for their old tenant's VMs**. (The SSH terminal is not affected — `resolveVmAccess` checks the VM's tenant — but monitoring is.)

**Fix:** Clear `user_vm_assignments` for the user when their tenant changes or is removed, and/or have the monitoring `tenant_user` scope join each `vm_id` back to the tenant and drop VMs that don't belong to the caller's current tenant.

### A3 — No "last admin" floor (self-lockout of the admin plane)
**Where:** `userController.updateUserRole`, `deleteUser`.

Self-role-change and self-delete are blocked, but nothing prevents an admin from **demoting or deleting the last _other_ admin**, or otherwise reducing the number of `admin` accounts to zero. With no admin left, the entire admin plane (tenant management, VM keys, infra) becomes unreachable except by direct DB access / the `create-admin` script.

**Fix:** Refuse to demote (`updateUserRole` away from `admin`) or delete a user if they are the last remaining `admin` (count check inside a transaction).

---

## Low

### A4 — `setVmSshConfig` accepts unvalidated `vm_id` / `ip_address` / `ssh_user`
**Where:** `deploymentController.setVmSshConfig` (admin, `POST /api/deployment/vm-ssh-config`).

Only presence is checked. `vm_id` is not validated against `VMID_RE` (it feeds the terminal, rotation, and monitoring), `ip_address` is unvalidated (the backend will SSH to whatever is stored), `ssh_port` isn't range-checked, and `ssh_user` is free text that the rotation job interpolates into the `authorized_keys` path (`/home/<user>/.ssh/...`). `tenant_id` isn't verified to exist (relies on the FK → 500). Admin-controlled, so low likelihood, but these are latent correctness/robustness gaps. Note this endpoint now **overlaps** with the vm-keys activation flow (both write `vm_ssh_config`).

**Fix:** Validate `vm_id` (VMID_RE), `ip_address` (IPv4/IPv6), `ssh_port` (1–65535), `ssh_user` (safe charset), and confirm the tenant exists. Consider consolidating the two `vm_ssh_config` writers.

### A5 — `infrastructure` page has no client-side role guard
**Where:** `app/dashboard/infrastructure/page.tsx`.

Every other admin page redirects non-admins (`tenants`, `monitoring` use `if (user.role !== 'admin') router.replace('/dashboard')`). The infrastructure page only checks `token` — a non-admin who navigates directly to `/dashboard/infrastructure` renders the **admin SSH-config management UI** (the add/edit VM-config form). The backend endpoints are `authorize('admin')`, so the data calls 403 and no data leaks, but the admin UI shell is exposed and it's inconsistent with the rest.

**Fix:** Add the same role guard used by the other admin pages.

### A6 — `createUser` has no password-strength or email-format validation
**Where:** `userController.createUser`.

Admin/tenant_admin can create a user with any password — no minimum length (unlike `changePassword`'s ≥8) — and email format isn't validated. Provisioned accounts can end up with weak credentials.

**Fix:** Enforce the same password policy as `changePassword` and validate email format on create.

### A7 — `assignObs` doesn't validate `vm_id` or VM↔tenant membership
**Where:** `expansionController.assignObs` (admin).

Presence-checks `tenant_id`/`vm_id` only; no `VMID_RE` check and no verification the VM actually belongs to the tenant's pool. Admin-trusted, so minor, but it can attach observability to a `vm_id` that isn't the tenant's.

**Fix:** Validate `vm_id` format; optionally confirm the VM is in the tenant's assignments/pool.

---

## Info / code quality

### A8 — Client-side role guards are UX-only
The guards on `tenants`/`users`/`orders` run in a `useEffect` after the initial render and data fetch fire. They are **not** a security boundary (the backend is). This is fine and expected — noting it so the model is explicit: server-side `authorize()` is the real control; the client guards are cosmetic/UX.

### A9 — `getUserById` self-view relies on `caller.id === id`
`getUserById` returns the record when `caller.id === id`. `req.params.id` is coerced by `parseId()` (number); if the JWT `id` is a string this strict-equality can fail, breaking a `tenant_user`'s ability to view their own profile via `/api/users/:id`. Correctness nit (not a security issue — admins/tenant_admins return earlier). Verify the JWT `id` type or compare loosely.

### A10 — Two writers of `vm_ssh_config`
`deploymentController.setVmSshConfig` and `vmKeyController.activateKey` both upsert `vm_ssh_config`. Not a bug, but they can drift (e.g. different `ssh_user` defaults — `root` vs `rachops`). Pick one authoritative path or share a helper.

---

## What's already good (no action)

- Every admin route gated with `authorize('admin')`; `tenant_admin` explicitly blocked from creating/escalating to `admin`.
- User listing/detail use `SAFE_FIELDS` — no `password_hash` exposure.
- Self-role-change and self-delete are blocked.
- `updateUserTenant` validates the tenant exists; `updateUserPool` validates the pool string; `getAllUsers` validates the role filter.

## Suggested priority order

1. **A1** — guard tenant deletion (it now destroys VM private keys).
2. **A2** — clear `user_vm_assignments` on tenant change + tenant-scope the monitoring `tenant_user` filter.
3. **A3** — last-admin floor.
4. **A4/A6/A7** — input validation on admin write endpoints.
5. **A5** — infrastructure page role guard.
6. **A8–A10** — cleanup / consistency.
