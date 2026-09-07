#!/usr/bin/env bash
# Build the site-controller image, smoke-test it, and save a gzipped tarball for the no-registry
# (k3s ctr import) path. Run from the RachBase REPO ROOT — needs Docker + internet.
#
# Usage:  ./apps/site-controller/build-and-package.sh [tag]
#         (tag defaults to apps/site-controller/package.json version)
set -euo pipefail

TAG="${1:-$(node -p "require('./apps/site-controller/package.json').version")}"
IMG="rachbase-site-controller:${TAG}"
OUT="site-controller-${TAG}.tar.gz"
# The k3s node (acme-vm-01) is amd64/x86_64; force that arch so the image runs there even when
# building on an Apple Silicon (arm64) Mac. Override with PLATFORM=linux/arm64 if your node is ARM.
PLATFORM="${PLATFORM:-linux/amd64}"

echo "→ building ${IMG} for ${PLATFORM} (context = repo root)"
docker build --platform "${PLATFORM}" -f apps/site-controller/Dockerfile -t "${IMG}" .

echo "→ smoke test: the app code loads inside the image (amd64 runs via emulation on Apple Silicon)"
docker run --rm --platform "${PLATFORM}" --entrypoint node "${IMG}" \
  -e "require('./src/renderers/manifests'); require('./src/cluster/arkaClient'); console.log('image OK')"

echo "→ saving ${OUT}"
docker save "${IMG}" | gzip > "${OUT}"
ls -lh "${OUT}"

echo
echo "✓ done. Upload TWO files to the cloud for ARKA:"
echo "    1. apps/site-controller/site-controller-handoff-${TAG}.zip   (docs + manifests)"
echo "    2. ${OUT}                                                    (the image tarball)"
echo "  ARKA follows IMAGE-INSTALL.md to import ${OUT} into k3s, then DEPLOY.md §4-§6."
