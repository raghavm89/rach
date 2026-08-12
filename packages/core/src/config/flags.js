'use strict';

/**
 * Config-driven feature flags.
 *
 * RachBase had no feature-flag system; this is the minimal gate required by the
 * Pro-tier rollout ("ship Phase 1 behind feature flags; nothing user-visible until
 * flipped" — docs/PRO_TIER_shared_pool_mapping.md).
 *
 * Flags are read from the environment at call time (so a process restart flips them,
 * and tests can set process.env before asserting). Every flag defaults to OFF; a flag
 * is ON only when its env var is one of: 1 / true / on / yes (case-insensitive).
 *
 * To add a flag: register it in FLAGS below, then gate code with isEnabled('name').
 */

const TRUTHY = new Set(['1', 'true', 'on', 'yes']);

// Registry: flag name → environment variable. Single source of truth.
const FLAGS = Object.freeze({
  // Pro (shared-pool, scale-to-zero) tier. OFF until Phase 1 is validated.
  pro_tier: 'FEATURE_PRO_TIER',
});

/** Is a registered feature flag enabled? Unknown flags are always false. */
function isEnabled(name) {
  const envVar = FLAGS[name];
  if (!envVar) return false;
  const v = String(process.env[envVar] ?? '').trim().toLowerCase();
  return TRUTHY.has(v);
}

/** Snapshot of every flag's state — handy for a read-only /flags endpoint. */
function allFlags() {
  return Object.fromEntries(Object.keys(FLAGS).map((name) => [name, isEnabled(name)]));
}

module.exports = { isEnabled, allFlags, FLAGS };
