# RachBase Site-Controller

Runs at **each SpaceArk (ARKA) site**. It does **all** cluster/ARKA activity via the
**private** Kubernetes API; the RachBase **BFF connects to it** over the site's HTTPS
API. The BFF never holds a kubeconfig.

```
 RachBase BFF (central, one place)            SpaceArk site (per region)
 ┌──────────────────────────┐  HTTPS   ─▶  https://api.<site>.paas.arkamicrostacks.com/v1
 │ product DB + outbox       │  mTLS + OAuth JWT + BFF-egress /32 allowlist
 │ (never holds a kubeconfig)│              │
 └──────────────────────────┘              ▼  site edge gateway → API facade
                                    ┌───────────────────────────────────────┐
                                    │  site-controller (this app)            │
                                    │   • api       — facade, request CRDs   │
                                    │   • tenant    — ns/quota/policy/RBAC    │
                                    │   • workload  — app runtime            │
                                    │   • build     — source→image, digest   │
                                    │        └▶ PRIVATE k8s API (local)       │
                                    └───────────────────────────────────────┘
```

Contract: *SpaceArk PaaS — Partner Control-Plane Developer Guide*. Design:
`docs/RachBase_SpaceArk_Integration_2026-08-17.md`.

## Three principles (your requirements — and the contract)

1. The site-controller is **linked locally** to ARKA's control plane (private k8s API).
2. The **RachBase backend (BFF) connects to** the site-controller (BFF → site HTTPS API).
3. The site-controller does **all** ARKA activities; the BFF holds no cluster credential.

## Layout

```
src/api/         the api facade: JWT verify, idempotency, request-CRD store (claimStore)
src/plans/       versioned plan catalog (site clamps against this)
src/renderers/   pure k8s resource builders — Deployment/Service/Ingress/RBAC/NetworkPolicy
                 (hardening baseline; unit-tested)
src/reconcilers/ tenant / workload / build reconcile loops + the shared engine
src/status/      safe reason/status normalization (no raw k8s leakage)
src/cluster/     kubeconfig loader (DEV) + k8s client + informer + leader election
src/profiles/    the 4 components; one (or a comma-list) is selected at startup, immutable
```

## Profiles (production)

One signed image; `SITE_CONTROLLER_PROFILE` selects exactly one, immutable for the
process lifetime. Each runs as its **own Deployment + ServiceAccount + minimal RBAC**
(a defect in the Internet-facing `api` facade must not grant namespace/workload rights).

```bash
SITE_CONTROLLER_PROFILE=api node index.js run              # facade only
SITE_CONTROLLER_PROFILE=tenant,workload node index.js run  # combined reconcilers
```

## Local dev (against the ARKA test cluster)

```bash
gpg --decrypt arka-kubeconfig.gpg > /tmp/arka.kubeconfig && chmod 600 /tmp/arka.kubeconfig
export ARKA_KUBECONFIG=/tmp/arka.kubeconfig
npm install
npm run health -w @rach/site-controller           # cluster connectivity
node apps/site-controller/index.js provision-demo 1   # render+apply hardened ns (renderer check)
npm test -w @rach/site-controller                 # pure renderer + hashing tests
```

## Status (v1.0.0 — ARKA-shippable)

- **Live:** `api` facade (mTLS-at-edge + OAuth JWT verify, idempotency, request-CRD store);
  `tenant` reconciler (namespace/quota/limits/SA/NetworkPolicy/per-tenant RBAC); `workload`
  reconciler (Deployment + Service + **per-app Ingress with Let's Encrypt TLS**, lifecycle
  suspend/scale, drift convergence); leader election; normalized status. Renderers, plan
  catalog, and canonical hashing are unit-tested (`npm test` — all green).
- **Public routing:** the workload reconciler creates a per-app Ingress (`<host>` → the app's
  ClusterIP Service) when `SITE_SELF_INGRESS=1`. It defers the Ingress until the host resolves
  on public DNS, and an app stays `RECONCILING` ("deploying") until its Ingress is up — then
  `ACTIVE` ("online"). TLS is Let's Encrypt HTTP-01 via the cluster's Traefik ACME resolver.
  The public host and auto-DNS (GoDaddy) are driven **from the BFF**; the host rides on the App
  CR as the `rachbase.io/host` annotation (schema-safe across CRD versions).
- **Build:** the `build` profile is a stub (`notImplemented`). The pure Release→outcome
  classifier is wired and unit-tested; the reconcile loop lights up when ARKA delivers the
  source→image build/ingest service. See DEPLOY.md §10 for the handoff — **no new
  site-controller image is required** if ARKA's build controller consumes the `Release` CRs and
  patches `App.spec.image`.

## Notes

- SpaceArk supplies **no** production kubeconfig — production runs in-cluster with a projected
  ServiceAccount token. The dev kubeconfig is for developing the reconcilers locally.
- SpaceArk owns the **image registry + source-to-image build service**; releases carry an exact
  commit SHA and deploy the resulting immutable digest.
- **Nothing environment-specific is hardcoded.** Domains, namespaces, ingress class/labels, DNS
  resolvers, SA names, and the ACME resolver are all env-overridable (see DEPLOY.md §8). The
  fixed strings that remain (`rachbase.io` CRD group, `rb-*` resource-name conventions) are
  contract identity, not deployment config.
