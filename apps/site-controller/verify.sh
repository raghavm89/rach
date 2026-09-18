#!/usr/bin/env bash
# Verify the site-controller in-cluster RBAC BEFORE cutover — safe to run alongside a
# kubeconfig-driven controller. Applies the split manifest (identities + RBAC + Deployments),
# removes the placeholder Deployments (their IMAGE isn't substituted yet — ImagePullBackOff),
# then runs `kubectl auth can-i` gate checks and prints PASS/FAIL.
#
# Usage:
#   ./verify.sh [MANIFEST] [TENANT_NAMESPACE]
# Defaults:
#   MANIFEST=deploy/site-controller.yaml   TENANT_NAMESPACE=<your rb-t-… namespace>
set -uo pipefail

MANIFEST="${1:-deploy/site-controller.yaml}"
TENANT_NS="${2:-rb-t-abbdd77c7ad24aab}"
SYS_NS="spaceark-site-system"
WSA="system:serviceaccount:${SYS_NS}:site-controller-workload"
TSA="system:serviceaccount:${SYS_NS}:site-controller-tenant"
fail=0

echo "→ context: $(kubectl config current-context 2>/dev/null || echo '?')"
echo "→ server-side dry-run validate"
kubectl apply --dry-run=server -f "$MANIFEST" >/dev/null || { echo "  DRY-RUN FAILED"; exit 1; }
echo "  ok"

echo "→ applying identities + RBAC (deployments removed after)"
kubectl apply -f "$MANIFEST" >/dev/null
kubectl -n "$SYS_NS" delete deploy --all >/dev/null 2>&1 || true
kubectl -n "$SYS_NS" delete svc site-controller-api >/dev/null 2>&1 || true

check() { # desc  expected(yes|no)  args...
  local desc="$1"; local want="$2"; shift 2
  local got; got="$(kubectl auth can-i "$@" 2>/dev/null)"
  if [ "$got" = "$want" ]; then echo "  PASS  $desc ($got)"; else echo "  FAIL  $desc (got '$got', want '$want')"; fail=1; fi
}

echo "→ RBAC gate"
check "workload can create deployments in tenant ns" yes create deployments --as="$WSA" -n "$TENANT_NS"
check "workload can create ingresses in tenant ns"   yes create ingresses   --as="$WSA" -n "$TENANT_NS"
check "workload can watch App CRDs"                   yes list apps.rachbase.io --as="$WSA" -n spaceark-site-requests
check "tenant can create namespaces (cluster)"       yes create namespaces  --as="$TSA"
check "workload CANNOT act in kube-system"            no  create deployments --as="$WSA" -n kube-system

echo
if [ "$fail" = 0 ]; then echo "✓ ALL CHECKS PASSED — in-cluster RBAC is correct."; else echo "✗ SOME CHECKS FAILED — see FAIL lines above."; fi
exit "$fail"
