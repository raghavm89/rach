# Local production-style mTLS loop (BFF ↔ site-controller)

Stands in for SpaceArk's edge gateway so the real transport (mTLS + short-lived OAuth JWT)
works on one machine:

```
BFF --https + mTLS--> terminator (:8443) --http--> api facade (:8090) --k8s--> CRDs
```

## 1. Generate the dev PKI (once)

From the repo root:

```
bash scripts/dev-mtls/gen-certs.sh secrets
```

Writes `ca.crt`, `server.{crt,key}`, `client.{crt,key}`, `oauth.{key,pub}` into `./secrets`.

## 2. Register the site (points site1 at the local terminator)

```
node apps/rachbase-backend/scripts/site-upsert.js upsert \
  --site-id site1 --api-url https://localhost:8443/v1 \
  --audience spaceark-site-api:site1 --ca-file secrets/ca.crt
```

## 3. BFF env (`apps/rachbase-backend/.env`) — the shared partner identity

```
MTLS_CERT_FILE=secrets/client.crt
MTLS_KEY_FILE=secrets/client.key
MTLS_CA_FILE=secrets/ca.crt
OAUTH_PRIVATE_KEY_FILE=secrets/oauth.key
SITE_ID=site1
OAUTH_CLIENT_ID=rachbase-bff
FEATURE_PRO_TIER=true
```

## 4. Facade env (the receiver)

```
SITE_CONTROLLER_PROFILE=api
API_PORT=8090
OAUTH_PUBLIC_KEY_FILE=secrets/oauth.pub
SITE_ID=site1
ARKA_KUBECONFIG=/path/to/arka.kubeconfig
```

## 5. Run (three terminals, from the repo root)

```
# a) facade on 8090
SITE_CONTROLLER_PROFILE=api API_PORT=8090 OAUTH_PUBLIC_KEY_FILE=secrets/oauth.pub \
  node apps/site-controller/index.js run

# b) mTLS terminator on 8443 → 8090
CERT_DIR=secrets UPSTREAM_PORT=8090 node scripts/dev-mtls/terminator.js

# c) BFF
npm run dev -w rachbase-backend
```

Hit **Redeploy**. You should see the facade log the `PUT /v1/tenants/.../apps/...` +
`POST .../releases`, and the BFF's `[site-status]` line go from `ECONNREFUSED` to a real
operation status. The tenant/workload/build reconcilers (separate `SITE_CONTROLLER_PROFILE`
processes against your kubeconfig cluster) then converge the CRDs into pods.

### Notes
- Paths are relative to the repo root (your cwd), so run all commands from there.
- If you regenerate the CA, re-run step 2 (the BFF must trust the new server cert).
- `secrets/` holds private keys — keep it git-ignored.
