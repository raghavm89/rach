# Runbook — Public links (per-app Ingress)

How to enable and operate public `https://<app>.rachbase.app` routing for container/BaaS
deploys. Routing is host-based: **one ingress IP per site**, Traefik routes each hostname to
the right tenant's Service, and DNS is created automatically on deploy.

---

## Model (read first)

- **One public ingress IP PER SITE**, not per app or per customer. Every `<sub>.rachbase.app`
  on a site points at that site's ingress IP; Traefik routes by `Host`. Stored on the `sites`
  row (`sites.ingress_ip`), resolved from the tenant's `site_id` at deploy.
- **DNS is automatic**: on deploy the backend upserts a GoDaddy A record
  `<sub>.rachbase.app → <that site's ingress_ip>`, and deletes it when the service is deleted.
- **Host is globally unique + safe**: claimed as `<slug>.rachbase.app` (or `svc-<id>` if the
  slug is taken/reserved); reserved platform subdomains (api/app/dashboard/…) are blocked; a
  custom domain must be an external FQDN (never a `rachbase.app` host).

---

## One-time enablement

### 1. Backend (rachbase-backend)
- Restart to apply migrations (`122_services_public_host`, `123_sites_ingress_ip`).
- Env:
  - `GODADDY_PAT` + `RACHBASE_DOMAIN=rachbase.app` — GoDaddy creds (same as the VM path).
  - `SITE_INGRESS_IP` — OPTIONAL single-site fallback only. For multi-site, leave unset and use
    per-site `sites.ingress_ip` (below).
  - Leave `SITE_APP_SPEC_HOST` **unset** (host rides as a CR annotation; spec.host stays off
    unless the ARKA App CRD declares it).

### 2. Set each site's ingress IP
`api_url` is required on upsert, so read the current value first:
```
curl -H "Authorization: Bearer $ADMIN_JWT" https://<backend>/api/site/sites
curl -X PUT https://<backend>/api/site/sites/<siteId> \
  -H "Authorization: Bearer $ADMIN_JWT" -H 'Content-Type: application/json' \
  -d '{"api_url":"<existing api_url>","ingress_ip":"<SITE_PUBLIC_IP>"}'
```
Quick IP-only change via SQL (restart backend or wait ~30s cache TTL):
```
UPDATE sites SET ingress_ip='<SITE_PUBLIC_IP>', updated_at=NOW() WHERE site_id='<siteId>';
```
`<SITE_PUBLIC_IP>` = the internet-facing IP where that site's Traefik serves :80/:443. Find it:
`kubectl get nodes -o wide` (EXTERNAL-IP) or, on a single-VM k3s, the VM's public IP
(`curl -s ifconfig.me` on the box). It must be PUBLIC — a `10.x/192.168.x` is not reachable.

### 3. Site-controller
- Env: `SITE_SELF_INGRESS=1` (required — turns the feature on). If your ingress controller isn't
  the k3s-default Traefik, also set `SITE_INGRESS_NAMESPACE`, `SITE_INGRESS_CLASS`,
  `SITE_INGRESS_POD_LABEL_KEY`, `SITE_INGRESS_POD_LABEL_VAL` to match it.
- Restart. Then **re-reconcile tenants** (redeploy any service, or wait for the inventory sweep)
  so each tenant namespace gets the `ingresses` RBAC + the scoped `allow-ingress-controller`
  NetworkPolicy.

### 4. TLS (Let's Encrypt via Traefik ACME)
`.app` is an HSTS-preloaded TLD → a **valid public cert is mandatory** (no http fallback, no
click-through). Set it up once on the cluster:

a. Configure Traefik with an ACME resolver named `le` (one-time, cluster-wide). Apply this
   HelmChartConfig (k3s re-rolls Traefik):
   ```
   apiVersion: helm.cattle.io/v1
   kind: HelmChartConfig
   metadata: { name: traefik, namespace: kube-system }
   spec:
     valuesContent: |-
       persistence: { enabled: true, path: /data }   # keeps acme.json across restarts
       additionalArguments:
         - "--certificatesresolvers.le.acme.email=YOU@rachbase.com"
         - "--certificatesresolvers.le.acme.storage=/data/acme.json"
         - "--certificatesresolvers.le.acme.httpchallenge=true"
         - "--certificatesresolvers.le.acme.httpchallenge.entrypoint=web"
   ```
   Verify: `kubectl -n kube-system describe pod -l app.kubernetes.io/name=traefik | grep certificatesresolvers`.
b. Set `SITE_INGRESS_CERTRESOLVER=le` on the site-controller, restart, redeploy.
c. **Port 80 MUST be open** to the site ingress IP — HTTP-01 validates over `http://<host>/.well-known/acme-challenge/…`.

GOTCHAS (learned the hard way):
- The app Ingress must bind **`websecure` only** when ACME is on. If it also binds `web` (:80),
  the app router intercepts the ACME challenge path and returns 404 → issuance fails. The
  reconciler now does this automatically when `SITE_INGRESS_CERTRESOLVER` is set.
- Let's Encrypt rate-limits **failed** validations (~5/hour/host). If you burned them debugging,
  wait an hour or point at LE staging (`--certificatesresolvers.le.acme.caserver=…staging…`) to
  confirm the flow, then switch back.

---

## Per-deploy (automatic — nothing manual)
On **Deploy latest**: the backend claims the unique host, sends it to the site as an annotation,
the reconciler creates the Ingress (`<host>` → the app's ClusterIP Service), and the A record
`<sub>.rachbase.app → site ingress_ip` is upserted. On **delete**: Ingress + A record removed.

---

## Verify
```
kubectl -n rb-t-<ref> get ingress -o wide            # host present, one ingress per app
kubectl -n rb-t-<ref> get networkpolicy allow-ingress-controller
dig +short <app>.rachbase.app                         # → the site's PUBLIC ingress IP
curl -H 'Host: <app>.rachbase.app' http://<PUBLIC_IP>/ # bypass DNS/TLS: proves cluster path
curl -I https://<app>.rachbase.app/                   # after TLS is set up
```

## Troubleshooting
- **No Ingress** → `SITE_SELF_INGRESS` not set / controller not restarted.
- **No DNS record** → `sites.ingress_ip` empty for the tenant's site (and no `SITE_INGRESS_IP`
  fallback), or GoDaddy not configured. Check backend logs for `auto-dns upsert … failed`.
- **DNS resolves but times out** → the ingress IP is private, or the NetworkPolicy pod-label
  doesn't match your Traefik pods (`kubectl -n kube-system get pods -l app.kubernetes.io/name=traefik --show-labels`).
- **404 from Traefik** → `SITE_INGRESS_CLASS` doesn't match your ingress class, or a duplicate
  Ingress for the same host exists (`kubectl -n rb-t-<ref> get ingress`).

## Security invariants (do not weaken)
- Ingress RBAC is a **namespaced** Role (`rb-workload`), never cluster-wide.
- The NetworkPolicy allows the ingress controller **only** (namespace + pod label), never all of
  kube-system. Revert any broad manual patch used during testing.
- Wildcard/host TLS keys live on the controller, never in a tenant namespace.
- Reserved subdomains + globally-unique hosts + custom-domain validation are enforced in
  `lib/publicHost` — keep them.
