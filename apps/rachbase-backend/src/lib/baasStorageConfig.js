'use strict';

/**
 * BaaS Storage configuration (Supabase-parity Settings + S3). Control-plane state, editable
 * before deploy and injected into the Storage container's env. Stored per project as JSONB.
 */

const DEFAULTS = Object.freeze({
  image_transformation: false,          // optimize/resize images on the fly
  file_size_limit_bytes: 52_428_800,    // global upload cap (50 MB default)
  s3_enabled: false,                    // allow S3-protocol clients
  region: 'us-east-1',                  // S3 region label
});

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function withDefaults(stored) {
  return { ...DEFAULTS, ...(isObj(stored) ? stored : {}) };
}

function applyPatch(stored, patch) {
  const next = withDefaults(stored);
  if (!isObj(patch)) return next;
  if ('image_transformation' in patch) next.image_transformation = Boolean(patch.image_transformation);
  if ('s3_enabled' in patch) next.s3_enabled = Boolean(patch.s3_enabled);
  if (patch.file_size_limit_bytes != null && patch.file_size_limit_bytes !== '' && Number.isFinite(Number(patch.file_size_limit_bytes))) {
    next.file_size_limit_bytes = Math.max(0, Math.trunc(Number(patch.file_size_limit_bytes)));
  }
  if (typeof patch.region === 'string' && patch.region.trim()) next.region = patch.region.trim();
  return next;
}

// Runtime subset for the Storage container (injected at deploy).
function toStorageEnv(config) {
  const c = withDefaults(config);
  return {
    FILE_SIZE_LIMIT: String(c.file_size_limit_bytes),
    IMAGE_TRANSFORM: String(c.image_transformation),
    S3_ENABLED: String(c.s3_enabled),
    S3_REGION: c.region,
  };
}

module.exports = { DEFAULTS, withDefaults, applyPatch, toStorageEnv };
