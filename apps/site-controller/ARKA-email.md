**Subject:** RachBase site-controller — deploy image + install steps (v1.0.4)

Hi team,

Two files for deploying the RachBase site-controller into the k3s cluster (links below):

- **`site-controller-1.0.4.tar.gz`** — the container image (imported directly into k3s; no registry needed)
- **`site-controller-handoff-1.0.4.zip`** — manifests + docs (`DEPLOY.md`, `IMAGE-INSTALL.md`, `verify.sh`, CRDs)

This runs **in-cluster as its own ServiceAccounts**, replacing the temporary kubeconfig-based controller we've been running. Steps below; `DEPLOY.md` has full detail.

**Prerequisites**
- `kubectl` admin access to the cluster (single-node k3s, `acme-vm-01`).
- From us, sent separately: the OAuth **public key** PEM (verifies our partner JWT) and the client-cert **CA** for your edge gateway's mTLS.
- Your edge gateway to terminate TLS/mTLS and route the site API + tenant app hostnames.

**1. Unzip the docs bundle**
```
unzip site-controller-handoff-1.0.4.zip && cd site-controller-1.0.4
```

**2. Create namespaces + install CRDs**
```
kubectl create namespace spaceark-site-requests    # request CRDs + leader-election Leases
kubectl create namespace spaceark-site-system      # the controller: reconciler SAs + Deployments
kubectl apply -f deploy/crds/
```

**3. Import the image into k3s containerd** (single node — see `IMAGE-INSTALL.md`)
```
sudo k3s ctr images import <(gunzip -c /path/to/site-controller-1.0.4.tar.gz)
sudo k3s ctr images ls | grep rachbase-site-controller
# expect: docker.io/library/rachbase-site-controller:1.0.4
```

**4. Create the OAuth verify-key Secret** (public key we send you)
```
kubectl -n spaceark-site-requests create secret generic rachbase-oauth \
  --from-file=public.pem=./oauth.pub
```

**5. Apply the controller** (split bundle — least-privilege; runs all four profiles)
```
sed 's#IMAGE#docker.io/library/rachbase-site-controller:1.0.4#' \
  deploy/site-controller.yaml | kubectl apply -f -
```

**6. Verify**
```
./verify.sh deploy/site-controller.yaml <a-tenant-namespace, e.g. rb-t-abbdd77c7ad24aab>
#   -> RBAC gate should print all PASS
kubectl -n spaceark-site-system get pods                                  # all Running
kubectl -n spaceark-site-system logs deploy/site-controller-workload --tail=30   # no 'forbidden'
```

**7. Edge gateway** (`DEPLOY.md` §7): expose the `site-controller-api` Service (443->8443) through your gateway with TLS + mTLS (trusting our client CA), and route tenant app hostnames (`*.rachbase.app`) to the per-tenant Services.

**8. Cutover coordination:** once the pods are healthy and the api Service is reachable through your gateway, tell us — we'll then stop our temporary kubeconfig controller so only the in-cluster one reconciles.

**Notes**
- **No registry required** — the image is imported directly; manifests use `imagePullPolicy: IfNotPresent`.
- **All four profiles** (`api`, `tenant`, `workload`, `build`) must run — the split bundle's four Deployments cover this, so please apply the whole file.
- `build` is a no-op stub until your source->image build service lands; prebuilt-image deploys work today, repo/source deploys wait on it.
- **Single node:** if you add nodes later, import the image on each (or we move to a registry).

Happy to hop on a call for the cutover. Thanks!
Raghav
