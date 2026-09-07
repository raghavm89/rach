# Site-controller acceptance — live-cluster gates

The offline gates run in CI (`node --test`, see `test/acceptance.test.js`): hostile-RBAC, restricted
PSS, CRD-schema completeness, secret hygiene, hash determinism, JWT auth, idempotency. This file is
the **live-cluster** checklist to run once the controller is deployed to a site. `K` = kubeconfig,
`NS=spaceark-site-requests`.

## 1. Rollout & health
```
kubectl -n $NS get deploy,pods -l app.kubernetes.io/part-of=rachbase 2>/dev/null || kubectl -n $NS get deploy,pods
kubectl -n $NS port-forward deploy/site-controller 8443:8443 &   # or the api Deployment in split mode
curl -s http://localhost:8443/v1/site      # → {"site":"...","ready":true}
```
✅ Pass: pods Ready; `/v1/site` returns `ready:true`.

## 2. Two replicas + single active leader (leader election)
```
kubectl -n $NS get lease | grep rb-           # rb-tenant-reconciler / rb-workload-reconciler
kubectl -n $NS get lease rb-workload-reconciler -o jsonpath='{.spec.holderIdentity}{"\n"}'
```
Run ≥2 replicas of each reconciler profile. ✅ Pass: exactly ONE holderIdentity per lease; the
other replicas stand by (no duplicate reconcile in logs).

## 3. Leader-election failover
```
LEADER=$(kubectl -n $NS get lease rb-workload-reconciler -o jsonpath='{.spec.holderIdentity}')
kubectl -n $NS delete pod "$LEADER"           # or the pod owning it
# watch the lease holder change within ~15s (leaseDuration) and reconciles resume
kubectl -n $NS get lease rb-workload-reconciler -o jsonpath='{.spec.holderIdentity}{"\n"}'
```
✅ Pass: a standby acquires the lease within the lease duration; app/tenant status keeps converging.

## 4. Node-disruption survival
```
kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
```
✅ Pass: controller pods reschedule and resume; existing tenant workloads (other nodes) stay up;
no request CRD or tenant namespace is lost. Uncordon the node afterwards.

## 5. Zero BFF k8s credentials (contract §0/§13)
On the BFF host / its Deployment:
```
# there must be NO kubeconfig and NO cluster token anywhere in the BFF env or mounts
env | grep -iE 'KUBE|ARKA_KUBECONFIG' ; ls -la ~/.kube 2>/dev/null
```
✅ Pass: the BFF has no kubeconfig, no ServiceAccount token for the site cluster — it reaches the
site ONLY via the HTTPS site API (mTLS + JWT). All cluster access is the site-controller's.

## 6. End-to-end smoke (BFF-driven)
Drive a tenant reconcile + a deploy from the BFF, then:
```
kubectl -n $NS get tenantclaims,apps,releases
kubectl get ns | grep rb-t
kubectl -n rb-t-<id> get deploy,pods,svc,secret     # pod Running; env in a Secret (envFrom), not inline
```
✅ Pass: the request CRDs are created, the tenant namespace is provisioned, the pod is Running, and
the app env lives in the `<app>-env` Secret (not inline in the Deployment).

## 7. Hardening spot-check on a live pod
```
kubectl -n rb-t-<id> get pod <pod> -o jsonpath='{.spec.securityContext.runAsNonRoot}{" "}{.spec.containers[0].securityContext.readOnlyRootFilesystem}{"\n"}'
```
✅ Pass: `true true` — non-root, read-only rootfs (with the writable `/tmp` emptyDir present).
