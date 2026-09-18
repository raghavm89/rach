'use strict';

/**
 * Build reconciler — resolve a Release to an APPROVED image digest for the workload
 * reconciler. Classifies the three deploy sources (decided 2026-08-21):
 *
 *   1. `image`         — an already-approved immutable digest (in ARKA's registry, or a
 *                        rollback to a prior build). No build/ingest → RESOLVED now.
 *   2. `externalImage` — a prebuilt image the customer brings (e.g. Docker Hub). ARKA must
 *                        INGEST it (pull → scan → sign → approved digest) before it can run,
 *                        because ARKA never runs a foreign-registry/mutable-tag image
 *                        (contract §7.2). ⛔ pending SpaceArk's image-ingest API.
 *   3. `source`        — build from an exact commit; optionally ON a customer-supplied
 *                        `baseImage`. Needs SpaceArk's source-to-image build service
 *                        (SBOM/scan/signature → digest). ⛔ pending that handoff.
 *
 * Both ⛔ paths are gated stubs until the corresponding SpaceArk service is delivered; the
 * classification + shape are wired so they light up the moment the API exists.
 */

// Pure: classify a Release → outcome (unit-tested).
function resolve(release) {
  const spec = release.spec || release;

  // 1) Already-approved digest → runnable now.
  if (spec.image) return { state: 'RESOLVED', image: spec.image };

  // 2) Prebuilt external image → must be ingested (scanned/signed) by ARKA first.
  if (spec.externalImage) {
    return { state: 'INGEST_PENDING', reason: 'AWAITS_SPACEARK_IMAGE_INGEST', externalImage: spec.externalImage };
  }

  // 3) Build from an exact commit (optionally on a customer base image).
  if (spec.source && spec.source.commitSha) {
    return {
      state: 'BUILD_PENDING',
      reason: 'AWAITS_SPACEARK_BUILD_SERVICE',
      commitSha: spec.source.commitSha,
      ...(spec.source.baseImage ? { baseImage: spec.source.baseImage } : {}),
    };
  }

  return { state: 'FAILED', reason: 'NO_SOURCE_OR_IMAGE' };
}

module.exports = { resolve };
