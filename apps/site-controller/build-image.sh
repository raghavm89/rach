#!/usr/bin/env bash
# Build (and optionally push) the RachBase site-controller image for ARKA.
#
# Build context is the REPO ROOT (the image bundles @rach/site-contracts) — this
# script cd's there for you regardless of where it is invoked from.
#
# Usage:
#   ./apps/site-controller/build-image.sh <registry> [tag] [--push]
# Examples:
#   ./apps/site-controller/build-image.sh registry.arkamicrostacks.com/rachbase
#   ./apps/site-controller/build-image.sh registry.arkamicrostacks.com/rachbase 1.0.0 --push
set -euo pipefail

REGISTRY="${1:?usage: build-image.sh <registry> [tag] [--push]}"
# Default tag = the version in package.json.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_TAG="$(node -p "require('${HERE}/package.json').version" 2>/dev/null || echo latest)"
TAG="${2:-$DEFAULT_TAG}"
PUSH=""
[[ "${2:-}" == "--push" || "${3:-}" == "--push" ]] && PUSH=1

IMAGE="${REGISTRY}/rachbase-site-controller:${TAG}"
ROOT="$(cd "${HERE}/../.." && pwd)"

echo "→ building ${IMAGE}"
echo "  context: ${ROOT}"
docker build -f "${ROOT}/apps/site-controller/Dockerfile" -t "${IMAGE}" "${ROOT}"

# Also tag :latest for convenience.
docker tag "${IMAGE}" "${REGISTRY}/rachbase-site-controller:latest"

if [[ -n "$PUSH" ]]; then
  echo "→ pushing ${IMAGE}"
  docker push "${IMAGE}"
  docker push "${REGISTRY}/rachbase-site-controller:latest"
else
  echo "✓ built ${IMAGE} (not pushed — pass --push to push)"
fi
