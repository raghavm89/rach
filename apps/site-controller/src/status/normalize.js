'use strict';

/**
 * Safe status normalization (SpaceArk contract §4.3 / §8).
 *
 * The site API returns ONLY normalized product states. Messages are
 * allowlisted/sanitized and contain NO raw Kubernetes errors, object dumps,
 * credentials, internal IPs, paths or stack traces.
 */

const STATES = ['ACCEPTED', 'RECONCILING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'DELETED'];

// Stable error codes (contract §8). Internal failures map onto these.
const ERROR_CODES = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'SITE_ACCESS_DENIED',
  409: 'IDEMPOTENCY_CONFLICT', // or GENERATION_CONFLICT depending on cause
  422: 'ADMISSION_REJECTED', // or PLAN_LIMIT_EXCEEDED
  429: 'SITE_BUSY',
  503: 'SITE_UNAVAILABLE',
};

function normalizeState(internal) {
  return STATES.includes(internal) ? internal : 'RECONCILING';
}

// Never leak raw cluster detail; default to no message until an allowlisted one is set.
function safeMessage(_raw) {
  return null;
}

module.exports = { STATES, ERROR_CODES, normalizeState, safeMessage };
