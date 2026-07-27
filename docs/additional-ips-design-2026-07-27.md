# Additional Public IPs — Design Sketch

*Date: 2026-07-27*

## 1. Problem

"Additional Public IP" (`ip`, ₹/$25/IP/month) is a billed catalog item but has **no
software behind it**. An order becomes a generic `vm_expansion_requests` row; an
admin clicks *Fulfil*, which only flips the row to `fulfilled` and stores a note.
The platform never records *which* IP was allocated, how many a VM/tenant holds,
or what each IP is for. The only IP Rachbase knows about is
`vm_ssh_config.ip_address` — the single primary IP it uses for SSH.

This sketch turns Additional IPs into a first-class, entitlement-gated,
admin-fulfilled resource with customer visibility — reusing the exact pattern we
just built for VM Logs / Observability.

## 2. Goals / non-goals

**Goals**
- Record each allocated IP (address, VM, tenant, purpose, status).
- Gate allocation by what was **paid** (quota = purchased `ip` quantity).
- Admin fulfilment that captures the *real* IP (from Arka) and binds it to a VM.
- Read-only customer view: "VM X has IPs a.b.c.d (egress), e.f.g.h (mail)".
- Optional: point an auto-domain's DNS at a chosen additional IP.

**Non-goals (v1)**
- Rachbase does **not** allocate IPs from the provider — Arka still does that
  out-of-band; the admin records the result.
- OS-level configuration on the VM (`ip addr add` / netplan) stays manual in v1
  (candidate for a later phase).

## 3. Data model

```sql
-- migration 038
CREATE TABLE vm_additional_ips (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vm_id        VARCHAR(100) NOT NULL,          -- qemu/<n> | lxc/<n>
  ip_address   INET         NOT NULL,
  purpose      TEXT,                            -- 'egress' | 'mail' | free text
  status       VARCHAR(12)  NOT NULL DEFAULT 'active',  -- active | released
  request_id   INTEGER      REFERENCES vm_expansion_requests(id) ON DELETE SET NULL,
  assigned_by  INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  released_at  TIMESTAMPTZ,
  UNIQUE (ip_address)                           -- an IP belongs to at most one VM
);
CREATE INDEX idx_vm_additional_ips_tenant ON vm_additional_ips(tenant_id, status);
```

`INET` gives free validation + supports IPv6 later. `status='released'` keeps
history and frees the slot without deleting the audit row.

## 4. Entitlement (reuses `lib/entitlements.js`)

- **quota** = `purchasedQty(tenant, 'ip')` — sum of paid `ip` slots (same source
  as obs/logs).
- **used** = count of `vm_additional_ips` where `status='active'` for the tenant.
- Assigning an IP requires `used < quota`; releasing frees a slot.

This mirrors `assignObs` / `assignLogs` exactly, so the admin UX is familiar.

## 5. API

Admin (under `/api/expansion`, `authorize('admin')`):

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/ips/quota` | — | purchased vs used per tenant |
| GET | `/ips/assignments?tenant_id=` | — | list allocated IPs |
| POST | `/ips/assign` | `{ tenant_id, vm_id, ip_address, purpose?, request_id? }` | quota-checked; validates IPv4/uniqueness; VM must belong to tenant |
| DELETE | `/ips/assign` | `{ id }` | sets `status='released'`, `released_at=NOW()` |

Tenant (read-only, `authorize('tenant_admin','tenant_user')`):

| Method | Path | Notes |
|---|---|---|
| GET | `/my-ips` | the caller-tenant's active IPs, grouped by VM |

## 6. Flows

**Purchase → allocate**
1. Customer orders `ip` (existing cart/expansion flow) → `vm_expansion_requests`
   row, `pending`.
2. Arka assigns a real IP to the VM out-of-band.
3. Admin opens the request, picks the VM, types the IP + purpose, submits
   `/ips/assign` (quota-checked). This inserts the `vm_additional_ips` row and can
   mark the linked request `fulfilled` in the same action.
4. Customer sees the IP on their VM/infrastructure page (read-only).

**Release**
- Admin hits release → `status='released'`, slot frees. (Billing proration is a
  separate decision — see §9.)

## 7. Admin UI

Extend the same monitoring/infra admin surface that now hosts the Obs + Logs
quota banners and per-VM toggles:
- An **Additional IPs** panel per tenant: quota chip (`used / quota`), a table of
  active IPs (address, VM, purpose, assigned date) with a *Release* action, and an
  *Assign IP* form (VM picker + IP input + purpose).

## 8. Optional: domain → additional IP (phase 2)

Today the auto-domain flow points the A record at the VM's **primary** IP. To let
a domain resolve to a secondary IP:
- Add nullable `additional_ip_id` to `deployment_domains`.
- In `addAutoDomain` / custom-domain apply, if set, call
  `godaddy.upsertARecord(sub, chosenIp)` instead of the primary IP.

Caveat: DNS pointing is easy; making a **service actually answer on that IP**
needs the app/systemd to bind it, which is a VM-config concern (phase 3). For the
common web cases this is unnecessary — Caddy already serves every domain on the
primary IP via SNI. The real secondary-IP use-cases (egress, SMTP, allowlisting)
aren't domain-driven, so phase 2 is genuinely optional.

## 9. Open decisions

1. **Who supplies the real IP?** Admin types it from Arka (v1 assumption), or do we
   want an Arka/rachops feed/endpoint that pushes allocated IPs automatically?
2. **Release & billing.** Does releasing an IP stop billing (proration / next-cycle
   removal), or is billing managed separately and release is just an ops action?
3. **Do we need domain→secondary-IP at all?** Given Caddy/SNI already serves all
   domains on one IP, phase 2 only matters if you have a concrete case. Skip unless
   asked.
4. **Automate VM config (phase 3)?** Should Rachbase SSH in and configure the IP
   (`ip addr add` / netplan) and optionally bind a service to it, or stay
   Arka-manual? Automation is the biggest chunk of work and only worth it at volume.

## 10. Phasing

- **Phase 1 (recommended now):** table + entitlement + admin assign/release +
  customer read-only view. Turns a blind billing line into a tracked, quota-gated
  resource. ~mirrors the Logs/Obs work already shipped.
- **Phase 2 (optional):** domain → additional-IP DNS binding.
- **Phase 3 (later, at volume):** automate OS-level IP config + service binding
  over SSH.
