# PaaS-on-a-VM — Design Doc

**Date:** 2026-07-26
**Scope:** Rachbase dashboard only. Evolve the deployment canvas from "services recorded against a VM" into a small Railway-style Platform-as-a-Service that runs on the tenant's own VM(s): multiple services per VM, per-service environment variables and build/start commands, a reverse proxy for routing, and auto-generated `*.rachbase.com` domains.
**Status:** Design only — no implementation. Captures the decisions from the design discussion.

---

## 1. Goal

Let a tenant run a real app — e.g. **backend + frontend + Postgres of one mobile/web app on a single VM** — from the Rachbase deployment canvas, with the Railway-style conveniences:

- Each service is its own card, wired to its VM (already shipped).
- Per-service **environment variables** (secrets encrypted).
- Per-service **build / start commands** so GitHub services actually *run*, not just record.
- Multiple web services share one VM behind a **reverse proxy**.
- A service with no custom domain gets an **auto domain** `name.rachbase.com` (name taken from the service card).

Rachbase stays **independent** — no dependency on rachdev; everything runs on the tenant's VM plus rachbase-backend.

## 2. Where we are today

Already built:

- **Deployment canvas** — draggable VM cards + service cards, SVG arrows service→VM, positions persisted per tenant (`deployment_canvas`).
- **Service types** — `deployment_services.source_type` = `github | postgres`, with `name`/`config`. Cross-tenant VM-ownership guard on create; deploy rate-limited.
- **Postgres provisioning** — native (apt + PGDG), over SSH, no Docker; stores connection details on the service `config`.
- **Per-VM SSH keys** — `vm_keys` (encrypted private keys, rotation, break-glass); terminal + tools use them.
- **GitHub deploy plumbing** — `runDeploy` (`@rach/deploy`) clones a repo to the VM over SSH; `deployment_logs` track runs.

What's missing to be a PaaS: a **process manager**, a **build step that honors user commands**, a **reverse proxy**, **env var delivery**, and **domains**.

## 3. Target architecture — the VM as a mini-host

Each VM becomes a host running several long-lived processes plus a router. Three new host-side primitives:

1. **Reverse proxy — Caddy.** Terminates TLS and routes by hostname to the right local port: `api.app.com → :3000` (backend), `app.app.com → :8080` (frontend). Caddy is chosen for automatic HTTPS (Let's Encrypt), a simple dynamic config, and first-class ACME support. It's what lets many web services share one VM and port 443.
2. **Process manager — systemd.** One unit per service (`rb-svc-<id>.service`) so a service survives crashes/reboots, restarts cleanly, and streams logs to `journalctl`. Postgres already runs under systemd natively.
3. **Build pipeline.** On deploy: pull the repo → run the user's install/build → (re)write the systemd unit with the start command + env file → `systemctl restart`.

```
                          rachbase-backend (control plane)
                                    | SSH (per-VM key)
                                    v
   Internet ──► Caddy :443 ──► ┌──────────────── VM ────────────────┐
   name.rachbase.com           │  backend  (systemd) :3000          │
                               │  frontend (systemd) :8080          │
                               │  postgres (systemd) :5432          │
                               └────────────────────────────────────┘
```

rachbase-backend never runs the workload; it **orchestrates over SSH** — writes files, runs commands, manages Caddy/systemd — exactly as `runDeploy` already does.

## 4. Feature — Environment variables per service

**Data.** A per-service env store; secrets encrypted at rest reusing the `keyCrypto` envelope encryption already built for VM keys.

```sql
CREATE TABLE deployment_service_env (
  id            SERIAL PRIMARY KEY,
  service_id    INTEGER NOT NULL REFERENCES deployment_services(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  value_enc     TEXT NOT NULL,          -- keyCrypto.seal(value)
  is_secret     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (service_id, key)
);
```

**Delivery.** On deploy, decrypt in memory and write an `EnvironmentFile` on the VM (`/etc/rachbase/<service>.env`, mode 600) referenced by the systemd unit; restart so the process picks them up. Never log values.

**UI.** A "Variables" section on the service detail panel — key/value editor, secret values masked (`•••••`), like Railway's Variables tab. Connection details from a Postgres service (host/port/db/user/password) can be offered as a one-click "reference" to inject into a backend service's env.

**Security.** Secrets encrypted at rest, decrypted only at deploy time; tenant-scoped by `service_id → tenant`. Requires `RACHBASE_KEY_ENC_SECRET` (already used for VM keys).

## 5. Feature — Build / start commands per service

**Data.** Add to `deployment_services.config` (JSONB): `root_dir`, `install_cmd`, `build_cmd`, `start_cmd`, `port`. Sensible defaults (`npm ci` / `npm run build` / `npm start`, port 3000). (Auto-detection via Nixpacks/buildpacks is a later enhancement; explicit commands first.)

**Runtime (extend `runDeploy`).** Over SSH: clone/pull to `root_dir` → `install_cmd` → `build_cmd` → write `/etc/systemd/system/rb-svc-<id>.service` with `ExecStart=<start_cmd>`, `EnvironmentFile=/etc/rachbase/<service>.env`, working dir = repo → `systemctl daemon-reload && systemctl restart rb-svc-<id>`. Capture step output into `deployment_logs`; runtime logs come from `journalctl -u rb-svc-<id>`.

**UI.** A "Settings → Deploy" section on the service card (build command, start command, root dir, port) and a "Logs" tab that tails `journalctl`.

## 6. Feature — Reverse proxy (Caddy) for multi-service-per-VM

**Install.** Ensure Caddy on the VM at first web-service deploy (apt via Caddy's repo), running under systemd.

**Config.** Rachbase manages Caddy per-VM. Simplest robust approach: a `/etc/caddy/rachbase.d/<service>.caddy` snippet per web service, imported by the main `Caddyfile`; on deploy write/replace the snippet and `systemctl reload caddy`. Each snippet maps a hostname → the service's local port:

```
name.rachbase.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy provisions and renews the TLS cert automatically. Postgres is TCP, not HTTP — it is *not* fronted by Caddy; it's reached directly on its port (firewalled), or later via a TCP proxy if a public DB endpoint is wanted.

## 7. Feature — Auto domains (`name.rachbase.com`)

**DNS is on GoDaddy** (registrar + zone for `rachbase.com`). GoDaddy **lifted** the old "10+ domains / Discount Domain Club" API restriction — a single-domain account can now generate API keys and manage DNS records programmatically. So automation stays on GoDaddy; no need to move to Cloudflare.

**Credentials.** A GoDaddy production API **key + secret** (developer.godaddy.com) on the account owning `rachbase.com`, stored **server-side only** in rachbase-backend. Used to create/delete records. A `403` indicates account ineligibility rather than a bad key.

**Recommended path — per-service A record + HTTP-01 TLS (simplest):**

1. Service created with a `name` and no custom domain.
2. Backend sanitizes the name and takes it **as-is** — `name.rachbase.com` (no tenant suffix, per decision). The hostname is **globally unique, first-come-first-served** across all tenants (enforced by `deployment_domains.hostname UNIQUE`); a **reserved-names** list blocks `www`, `api`, `app`, `admin`, `mail`, etc. On collision, the tenant is asked to pick another name.
3. GoDaddy API creates `A name.rachbase.com → <VM public IP>`.
4. Backend writes the Caddy snippet for that host.
5. Caddy obtains the Let's Encrypt cert over **HTTP-01** (needs port 80 reachable) — **GoDaddy is used only for the A record**, no DNS plugin, no wildcard.
6. Card shows a "provisioning domain…" state until DNS resolves + cert issues, then "live" with the URL.

On delete: remove the A record + Caddy snippet.

**Alternative — wildcard `*.rachbase.com` + DNS-01 (only if centralizing routing later).** Needs TXT-record challenges; GoDaddy is a supported ACME DNS provider (`caddy-dns/godaddy`, Certify The Web, etc.). More moving parts; deferred.

**GoDaddy caveats to design around:**
- **Propagation** is slower than Cloudflare (minutes) — hence the "provisioning" state on the card.
- **Rate limits** — space out record operations (fine at expected volume).
- **Escape hatch:** delegate a subdomain (`apps.rachbase.com` NS → Cloudflare) if propagation/reliability ever hurts, keeping the apex + registrar on GoDaddy. Not needed to start.

```sql
CREATE TABLE deployment_domains (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES deployment_services(id) ON DELETE CASCADE,
  hostname    TEXT NOT NULL UNIQUE,       -- name.rachbase.com or a custom domain
  is_auto     BOOLEAN NOT NULL DEFAULT true,
  status      TEXT NOT NULL DEFAULT 'provisioning',  -- provisioning | live | failed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 8. UI — service detail panel (Railway-style)

Keep the canvas as the overview (card = node). Clicking a service card opens a **detail panel with tabs**, mirroring Railway:

- **Deployments** — history + status (from `deployment_logs`), redeploy.
- **Variables** — env editor (§4).
- **Settings** — build/start/root/port (§5), domains (§7: auto domain shown, add custom).
- **Logs** — tail `journalctl` for the service.
- **Postgres services** additionally get **Connect** (connection string) and optionally a **Data** view.

## 9. Single-VM topology — tradeoffs & tiers

Running backend + frontend + Postgres on one VM is viable and common for small apps, with honest caveats:

- **No isolation** between a tenant's processes beyond the OS; a busy backend can starve Postgres (shared CPU/RAM).
- **Single point of failure** — one VM down takes the whole app down.
- **Scaling ceiling** — vertical only until you split services across VMs.

**Decision — tiering:** single-VM-all-services (backend + frontend + native Postgres together) is the **default**. The **upsell** is a dedicated DB: when a tenant purchases the **Managed PostgreSQL** catalog item (`db`), that database is placed on **its own VM** instead of running as a native service on the app VM. The data model already supports many services across many VMs, so "DB on its own VM" is a placement decision, not a redesign — a `postgres` service simply targets a different `vm_id`.

## 10. Security considerations

- **Env secrets** encrypted at rest (`keyCrypto`), decrypted only in memory at deploy; env files mode-600 on the VM.
- **Tenant isolation** — every service/domain/env row is tenant-scoped; deploy already guards VM ownership (audit T1) and is rate-limited (T6). Domain creation must verify the service (and thus VM) belongs to the caller.
- **Public exposure** — Caddy gives per-domain TLS. The VM firewall should allow 80/443 (web) and restrict Postgres (5432) to trusted sources; auto-domains make services internet-reachable, so default-deny + explicit exposure is the safe posture.
- **GoDaddy API secret** lives only in rachbase-backend; never shipped to the client.
- **SSH** uses the per-VM key already in place; run-command/deploy paths are tenant-scoped.

## 11. Data model — summary of changes

| Object | Change |
|--------|--------|
| `deployment_services.config` | add `root_dir`, `install_cmd`, `build_cmd`, `start_cmd`, `port` |
| `deployment_service_env` (new) | per-service env vars, `value_enc` sealed |
| `deployment_domains` (new) | per-service hostnames + provisioning status |
| VM host files | `/etc/systemd/system/rb-svc-<id>.service`, `/etc/rachbase/<service>.env`, `/etc/caddy/rachbase.d/<service>.caddy` |

## 12. Phased roadmap (each slice ships on its own)

1. **Env vars (encrypted) on the service card.** Smallest, high value, reuses `keyCrypto`. No host changes beyond writing an env file used in the next phase.
2. **Build/start commands + real `runDeploy` + systemd unit + Logs tab.** Makes GitHub services actually run. Consumes the env file from phase 1.
3. **Caddy reverse proxy on the VM.** Ports → hostnames; unlocks multiple web services per VM.
4. **Auto domains** (`name.rachbase.com` via GoDaddy API + Caddy HTTP-01) + custom-domain support. Depends on phase 3.
5. **Service detail panel** (tabs) — can land incrementally alongside 1–4, or be pulled forward as the home for Variables/Settings.

## 13. Decisions (resolved)

- **GoDaddy API key** — *prerequisite, still open.* Must be minted on the `rachbase.com` account before phase 4.
- **Build model** — **Explicit commands now.** Users type `install_cmd` / `build_cmd` / `start_cmd` (with sensible defaults). Nixpacks/auto-detect deferred.
- **Auto-domain naming** — **`name` only, no tenant suffix.** `name.rachbase.com`, globally unique first-come-first-served, with a reserved-names blocklist. (Trade-off accepted: service names become globally-scoped public subdomains; one tenant can claim a name another wanted.)
- **Firewall** — **Default-deny.** Open 80/443 for web; restrict 5432 (Postgres) to trusted sources only.
- **Tiering** — **Single-VM-all-services is the default;** purchasing the Managed PostgreSQL (`db`) catalog item is the upsell that moves the database onto its own VM.
- **Process manager** — **systemd** (one unit per service). Already present on the VMs.
- **Canvas** — **Keep the current dependency-free canvas as-is.** No React Flow; the service detail panel layers on top of it.

**Only remaining prerequisite:** mint the GoDaddy API key on the `rachbase.com` account. Everything else is decided.
