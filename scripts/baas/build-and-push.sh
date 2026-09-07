#!/usr/bin/env bash
#
# Build & push the 3 BaaS images (gateway + combined services + PostgREST), then print the
# BAAS_*_IMAGE env vars to set on rachbase-backend. This is the 3-container-per-project topology.
#
# The 2 in-repo images (gateway, services=auth+storage+functions) depend on the @rach/baas workspace
# package, so their build context MUST be the repo root — the Dockerfiles copy package.json +
# packages/baas + the app dirs. The 3rd (rest) is stock PostgREST: we retag + push it so the cluster
# pulls everything from one registry (skip with PUSH_POSTGREST=0 to reference it directly).
#
# Usage:
#   REGISTRY=ghcr.io/you TAG=v1 ./scripts/baas/build-and-push.sh
#
# Env:
#   REGISTRY         (required) e.g. ghcr.io/acme, docker.io/acme, 123.dkr.ecr.us-east-1.amazonaws.com
#   TAG              image tag (default: git short SHA, else "latest")
#   POSTGREST_IMAGE  upstream PostgREST to mirror (default: postgrest/postgrest:v12.2.3)
#   PUSH_POSTGREST   1 = pull/retag/push PostgREST into REGISTRY (default); 0 = reference it directly
#   PLATFORM         docker buildx platform (default: linux/amd64 — matches the RachBase
#                    SpaceArk cluster). Set PLATFORM=linux/arm64 only if you deploy to arm nodes,
#                    else the containers won't start (exec-format error).
#   PUSH             1 = push (default); 0 = build only

set -euo pipefail

# Preflight: docker buildx must be available (needed for --platform / --push).
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker not found on PATH." >&2; exit 1; }
docker buildx version >/dev/null 2>&1 || { echo "ERROR: 'docker buildx' unavailable — install/enable Buildx, then 'docker buildx create --use'." >&2; exit 1; }

# Resolve repo root (this script lives in scripts/baas/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

: "${REGISTRY:?Set REGISTRY, e.g. REGISTRY=ghcr.io/you}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-1}"
PUSH_POSTGREST="${PUSH_POSTGREST:-1}"
POSTGREST_IMAGE="${POSTGREST_IMAGE:-postgrest/postgrest:v12.2.3}"

# --load can only materialise a SINGLE-platform build; a multi-platform build must be pushed.
if [ "$PUSH" != "1" ] && printf '%s' "$PLATFORM" | grep -q ','; then
  echo "ERROR: multi-platform PLATFORM=$PLATFORM requires PUSH=1 (buildx --load can't load >1 platform)." >&2
  exit 1
fi

case "$PLATFORM" in
  *amd64*|*arm64*) : ;;  # amd64 = RachBase cluster default; arm64 supported for arm nodes
  *) echo "NOTE: unusual PLATFORM=$PLATFORM — ensure it matches your cluster's node arch." ;;
esac

# in-repo image -> Dockerfile (baas-services = combined auth+storage+functions)
IN_REPO=(gateway services)
declare -A dockerfile=(
  [gateway]=apps/baas-gateway/Dockerfile
  [services]=apps/baas-services/Dockerfile
)

img() { echo "${REGISTRY}/rachbase-baas-$1:${TAG}"; }
load_flag() { [ "$PUSH" = "1" ] && echo "--push" || echo "--load"; }

echo "==> Building BaaS images  (registry=$REGISTRY tag=$TAG platform=$PLATFORM push=$PUSH)"
for s in "${IN_REPO[@]}"; do
  ref="$(img "$s")"
  echo "--- $s  ->  $ref"
  docker buildx build --platform "$PLATFORM" $(load_flag) \
    -f "${dockerfile[$s]}" -t "$ref" .
done

# 3rd image: stock PostgREST (mirrored so the cluster pulls everything from one registry).
REST_REF="$POSTGREST_IMAGE"
if [ "$PUSH_POSTGREST" = "1" ]; then
  REST_REF="$(img rest)"
  echo "--- rest (PostgREST)  ->  $REST_REF  (mirroring $POSTGREST_IMAGE)"
  docker pull --platform "$PLATFORM" "$POSTGREST_IMAGE"
  docker tag "$POSTGREST_IMAGE" "$REST_REF"
  [ "$PUSH" = "1" ] && docker push "$REST_REF"
else
  echo "--- rest (PostgREST)  ->  $REST_REF  (referenced directly; cluster must reach it)"
fi

echo
echo "==> Done. Set these on the rachbase-backend service, then redeploy a project (POST /baas/deploy):"
echo
echo "BAAS_GATEWAY_IMAGE=$(img gateway)"
echo "BAAS_SERVICES_IMAGE=$(img services)"
echo "BAAS_REST_IMAGE=$REST_REF"
