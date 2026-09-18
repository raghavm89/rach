# RachBase site-controller — SpaceArk deployment guide

This is the partner-built controller that runs **at your (SpaceArk/ARKA) site**. It receives
the RachBase BFF's site-API calls, turns them into request CRDs, and reconciles them into the
Kubernetes cluster (tenant namespaces + workloads). One image, selectable startup profiles.

The RachBase BFF connects to it over your site's HTTPS edge; the BFF never holds a kubeconfig.

---

## 0. What's in this package

```
site-controller-1.0.4/                        # this bundle
  Dockerfile                                  # reference only — ARKA pulls the pushed image
  build-image.sh                              # build/push helper (run from the RachBase repo)
  verify.sh                                   # RBAC dry-run + can-i gate checks
  README.md / DEPLOY.md / .env.example        # docs + full env reference
  deploy/
    crds/{tenantclaim,app,release}.yaml       # the rachbase.io CRDs
    site-controller-all-in-one.yaml           # ONE Deployment, all profiles (simple)
    site-controller.yaml                       # split: one Deployment per profile (least-privilege)
    rachbase-oauth-secret.example.yaml         # the JWT verify key Secret (fill in)
RUNBOOK-ingress.md                            # (repo root) operating self-managed public routing
```

---

## 1. Request flow (what you're operating)

```
RachBase BFF  --HTTPS + mTLS + short-lived OAuth JWT-->  your edge gateway
              --plain HTTP-->  site-controller `api` facade  (verifies the JWT)
                              --> writes request CRDs (namespace: spaceark-site-requests)
   tenant/workload/build reconcilers  --watch CRDs-->  converge the cluster (private k8s API)
```

- **mTLS is terminated at your edge gateway**, not in the controller. The `api` facade is plain
  HTTP behind the gateway and independently verifies the partner JWT (defence in depth).
- Only the `api` facade is reachable from the gateway. The reconcilers are cluster-internal.

---

## 2. Prerequisites

- A Kubernetes cluster (tested on k3s v1.36) and `kubectl` admin access.
- A container registry your cluster can pull from.
- **From RachBase (out of band):** the OAuth **public** key PEM (verifies the BFF's JWT), and
  the client-cert **CA** for your edge gateway's mTLS trust store.
- An edge gateway/ingress you control for TLS + mTLS + routing + DNS (see §7).

---

## 3. Build & push the image

> Done on the **RachBase** side, not by ARKA — the image bundles `@rach/site-contracts`, so its
> build context is the RachBase monorepo root (these paths are repo-relative, not bundle-relative).
> ARKA only needs the resulting **pushed image reference** for §6.

Use the helper (from the RachBase repo root):

```
./apps/site-controller/build-image.sh <registry> [tag] [--push]
# e.g. ./apps/site-controller/build-image.sh registry.arkamicrostacks.com/rachbase 1.0.4 --push
```

`tag` defaults to the `package.json` version (currently **1.0.4**). Or build by hand:

```
docker build -f apps/site-controller/Dockerfile -t <registry>/rachbase-site-controller:1.0.4 .
docker push <registry>/rachbase-site-controller:1.0.4
```

The `.dockerignore` at the repo root keeps `.env`, `node_modules`, and tests out of the image.

---

## 4. One-time cluster setup

```
kubectl create namespace spaceark-site-requests   # request CRDs + leader-election Leases
kubectl create namespace spaceark-site-system      # the controller: reconciler SAs + Deployments
kubectl apply -f deploy/crds/
```

(The image also has a dev `bootstrap` command that does this via kubectl; in production apply
the CRDs yourself.)

---

## 5. Provide the auth key

RachBase gives you the OAuth **public** key PEM — this is `OAUTH_PUBLIC_KEY_FILE`. Create the
Secret the Deployment mounts:

```
kubectl -n spaceark-site-requests create secret generic rachbase-oauth \
  --from-file=public.pem=./oauth.pub
```

(or edit + apply `deploy/rachbase-oauth-secret.example.yaml`). Without this, every mutation the
BFF sends is rejected `401 UNAUTHENTICATED`.

**Key pairing / dev vs prod.** This is one half of a keypair: the BFF **signs** the JWT with the
private half (`OAUTH_PRIVATE_KEY` in RachBase's secret store, never shared); the site-controller
**verifies** with this public half. They must match. Use RachBase's **production** OAuth public
key here — do NOT reuse the local `scripts/dev-mtls` throwaway key (`secrets/oauth.pub`) outside
of local/staging tests. The public key is not sensitive; the private key stays with RachBase.
Also set `OAUTH_ISSUER`/`OAUTH_AUDIENCE` to match whatever the production BFF puts in the token.

---

## 6. Deploy

> **All four profiles (`api`, `tenant`, `workload`, `build`) must be running in production.**
> `api` is the HTTP facade the BFF uses to send deploys AND to poll status — without it the
> dashboard can't talk to the site at all (deploys go nowhere, status never updates). `tenant`
> owns namespaces/quota/RBAC, `workload` owns app runtime + ingress, `build` is a harmless no-op
> stub until SpaceArk's build service lands. The manifests set `SITE_CONTROLLER_PROFILE` for you
> (split = one profile per Deployment; all-in-one = the combined value) — just don't apply a
> partial set. With the split bundle, apply **all four** Deployments.

Pick one topology. Replace `IMAGE` with your pushed reference first.

**All-in-one (simple — one Deployment, one ServiceAccount holding the union of RBAC):**
```
sed 's#IMAGE#<registry>/rachbase-site-controller:<tag>#' \
  deploy/site-controller-all-in-one.yaml | kubectl apply -f -
```

**Split (least-privilege — one Deployment per profile; the public `api` has no namespace/
workload RBAC):** apply `deploy/site-controller.yaml` (same `IMAGE` substitution). Recommended
if you want the internet-facing facade to have zero blast radius. See the design doc §5.1 for
the trade-off; a good middle ground is `SITE_CONTROLLER_PROFILE=tenant,workload,build` combined
with a separate `api` Deployment.

Expose the `api` Service (port 443 → 8443) through your edge gateway.

**Test/dev exposure (optional):** the split `site-controller-api` Service is ClusterIP only. To
reach the api on the node IP at `:8443` for testing without a gateway, apply the overlay:
```
kubectl apply -f deploy/site-controller-api-lb.yaml   # k3s servicelb → node:8443
curl -s http://<node-ip>:8443/v1/site                 # {"site":"site1","ready":true}
```
⚠ This is plain HTTP (JWT in cleartext) — test only. Production uses the gateway below.

---

## 7. Edge gateway (your responsibility)

For the BFF to reach the facade and for tenant apps to get public URLs, the gateway must:

1. Terminate **TLS** (public server cert) and require **mTLS** (trust RachBase's client CA).
2. Validate source IP allowlist for the BFF egress /32s.
3. Route `https://api.<site>.paas.arkamicrostacks.com/v1/*` → the `site-controller-api` Service.
4. Route tenant app hostnames (`<app>.rachbase.app` or customer custom domains) → the
   per-tenant `Service` in `rb-t-<id>`, with DNS + TLS.

Two ways to publish app hostnames — pick one:

**(a) Edge-published (default).** The controller creates only the in-cluster `Service`;
publishing the route/DNS/TLS is the edge's job. The desired host arrives on the App CR as the
`rachbase.io/host` annotation (and `spec.host` if your CRD declares it).

**(b) Self-managed Ingress (`SITE_SELF_INGRESS=1`).** The workload reconciler creates a per-app
`Ingress` (`<host>` → the app's ClusterIP Service) plus a **scoped** NetworkPolicy that admits
your ingress controller only. TLS is Let's Encrypt via your Traefik ACME resolver; the BFF
drives the public host + auto-DNS (GoDaddy). This is the path validated end-to-end
(`https://<app>.rachbase.app` → HTTP/2 200 with a valid LE cert). Operate it via
`RUNBOOK-ingress.md` (repo root). One-time TLS setup:

- Configure your cluster's Traefik with an ACME resolver (HTTP-01), e.g. named `le`:
  ```
  --certificatesresolvers.le.acme.email=<you>@<domain>
  --certificatesresolvers.le.acme.storage=/data/acme.json    # persistent volume
  --certificatesresolvers.le.acme.httpchallenge=true
  --certificatesresolvers.le.acme.httpchallenge.entrypoint=web
  ```
- Set `SITE_INGRESS_CERTRESOLVER=le` on the workload profile.
- **Port 80 must be open** to the site ingress IP (HTTP-01 validates over `http://<host>/.well-known/acme-challenge/…`).
- The app Ingress binds `websecure` only when a certresolver is set, so the ACME challenge on
  :80 isn't intercepted (the reconciler does this automatically).

Security invariants for (b): the ingress RBAC is a **namespaced** Role (never cluster-wide), the
NetworkPolicy admits the ingress controller **only** (namespace + pod label), and TLS keys live
on the controller — never in a tenant namespace. Do not weaken these.

---

## 8. Environment reference

| Var | Required | Default | Purpose |
|---|---|---|---|
| `SITE_CONTROLLER_PROFILE` | ✅ | — | `api` \| `tenant` \| `workload` \| `build`, or a comma list (combined) |
| `SITE_ID` | ✅ | `site1` | site identity; JWT audience default `spaceark-site-api:<SITE_ID>` |
| `OAUTH_PUBLIC_KEY_FILE` | ✅ (api) | — | RachBase JWT verify key (mounted from the `rachbase-oauth` Secret) |
| `API_PORT` | — | `8443` | `api` facade HTTP port |
| `OAUTH_ISSUER` | — | — | set only if the BFF sets an issuer; must match |
| `OAUTH_AUDIENCE` | — | `spaceark-site-api:<SITE_ID>` | override JWT audience |
| `SITE_REQUESTS_NAMESPACE` | — | `spaceark-site-requests` | where request CRDs live |
| `SITE_CONTROLLER_NAMESPACE` | — | `spaceark-site-system` | namespace holding the reconciler SAs — the exact namespace every per-tenant `rb-workload`/`rb-build` RoleBinding **subject** references. It MUST be where the reconciler SAs actually live, or in-cluster deploys 403. Both bundles use `spaceark-site-system`. |
| `WORKLOAD_RECONCILER_SA` | — | `site-controller-workload` | SA the `rb-workload` RoleBinding binds (**all-in-one: `site-controller`**) |
| `BUILD_RECONCILER_SA` | — | `site-controller-build` | SA the `rb-build` RoleBinding binds (**all-in-one: `site-controller`**) |
| `SITE_GATEWAY_NAMESPACE` | — | `spaceark-edge` | edge gateway namespace for the ingress NetworkPolicy |
| `SITE_APPS_DOMAIN` | — | `apps.rachbase.app` | fallback host for app URLs (host normally comes from the BFF) |
| `IDEMPOTENCY_CONFIGMAP` | — | — | ConfigMap name for durable, replica-shared idempotency (else in-memory) |
| `POD_NAME` | — | — | leader-election identity; set via the downward API for stable identity |
| **Public routing (workload)** | | | |
| `SITE_SELF_INGRESS` | — | unset (off) | `1` = the workload reconciler creates a per-app Ingress; off = Service only |
| `APPS_DOMAIN` | — | `rachbase.app` | base domain for platform hosts (label/fallback; host normally arrives from the BFF) |
| `SITE_INGRESS_NAMESPACE` | — | `kube-system` | namespace of your ingress controller |
| `SITE_INGRESS_CLASS` | — | `traefik` | ingress class name |
| `SITE_INGRESS_POD_LABEL_KEY` | — | `app.kubernetes.io/name` | ingress-controller pod label (for the scoped NetworkPolicy) |
| `SITE_INGRESS_POD_LABEL_VAL` | — | `traefik` | ingress-controller pod label value |
| `SITE_INGRESS_CERTRESOLVER` | — | — | Traefik ACME resolver name (e.g. `le`) for Let's Encrypt TLS; empty = no TLS annotations |
| `SITE_DNS_CHECK_RESOLVERS` | — | `8.8.8.8,1.1.1.1` | public resolvers checked before publishing an Ingress (DNS-propagation gate) |
| `SITE_APP_SPEC_HOST` | — | unset | `1` ONLY if your App CRD declares `spec.host`; otherwise the host rides as an annotation |
| `SITE_BUILDS_ENABLED` | — | `false` | enable the build path once ARKA's source→image service is wired |
| `ARKA_KUBECONFIG` / `KUBECONFIG` | — | — | **DEV ONLY. Leave UNSET in production** — the controller uses the in-cluster projected ServiceAccount |

---

## 9. Verify

```
kubectl -n spaceark-site-requests get pods
kubectl -n spaceark-site-requests port-forward deploy/site-controller 8443:8443 &
curl -s http://localhost:8443/v1/site        # → {"site":"site1","ready":true}
```

End to end: have the BFF reconcile a tenant and deploy — you should see `TenantClaim`/`App`/
`Release` created in `spaceark-site-requests`, an `rb-t-<id>` namespace provisioned, and a pod
Running in it.

```
kubectl -n spaceark-site-requests get tenantclaims,apps,releases
kubectl get ns | grep rb-t
```

---

## 10. Known handoffs / not-yet-wired

- **Build service (ARKA-owned) — no new site-controller image needed.** The `build` profile is a
  placeholder; source→image build (SBOM/scan/sign → immutable digest) is SpaceArk's to implement.
  The integration is **CRD-driven and already wired on the RachBase side**:
  1. On a source deploy the BFF writes **both** an `App` CR (`spec.image: null`) and a `Release`
     CR (`spec.source.{provider,repositoryRef,commitSha}`, or `spec.externalImage` for a
     prebuilt image to ingest) into `spaceark-site-requests`.
  2. The workload reconciler **waits**: an App with no image stays `RECONCILING` and deploys
     nothing until an image appears.
  3. **ARKA's build controller** reconciles the `Release` (build/ingest → approved digest) and
     **patches the digest onto `App.spec.image`**.
  4. The workload reconciler sees the image and deploys — no code change here.

  So when ARKA adds the build service as a controller that consumes our `Release` CRs and sets
  `App.spec.image`, **the current site-controller image handles it as-is** — just grant ARKA's
  build controller RBAC to build and to patch the `App` CR. A new site-controller image is only
  needed if ARKA's build service is an **API the controller must call** (rather than a CR
  reconciler) — in that case RachBase implements the `build` profile and ships a new image.
  Until the build service exists, releases from a Git commit stay `BUILD_PENDING`; prebuilt-image
  deploys (approved digest) work today.
- **Monitoring/logs** — no metrics/logs endpoint is wired for shared containers yet.
- **RBAC finalization** — the split/all-in-one manifests grant `roles`/`rolebindings` create so
  the tenant reconciler can bind per-tenant Roles; SpaceArk SRE should scope the `bind` verb to
  the exact `rb-workload`/`rb-build` roleRefs rather than a broad grant (§11.2). Also: the
  `rb-workload` Role now includes **namespace-scoped `secrets`** (for the app's own env Secret,
  consumed via `envFrom`). For the tenant reconciler to *create* a Role granting `secrets`, its
  ServiceAccount needs the matching `secrets` permission or `escalate` — please approve this
  narrow, per-tenant grant.
- **App URLs** — the controller emits the desired host on the App/Service; DNS + ingress + TLS
  to publish it are the edge's (§7).
