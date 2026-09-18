'use strict';

/**
 * BaaS Storage policy (Phase 3, slice 4) — PURE access decisions. Buckets have a visibility;
 * the caller's role comes from the verified project JWT (anon / authenticated / service_role).
 * `service_role` bypasses policy; `anon` is public-read only; `authenticated` reads private and
 * writes. Object ownership refinements come later — this is the v1 matrix.
 */

const ROLES = ['anon', 'authenticated', 'service_role'];
const VISIBILITY = ['public', 'private'];

const norm = (bucket) => ({ visibility: (bucket && bucket.visibility) === 'public' ? 'public' : 'private' });

function canRead(role, bucket) {
  if (role === 'service_role') return true;
  const b = norm(bucket);
  if (b.visibility === 'public') return true;          // public buckets: anyone can read
  return role === 'authenticated';                      // private: signed-in users
}
const canList = canRead;

function canWrite(role, bucket) {
  if (role === 'service_role') return true;
  return role === 'authenticated';                      // anon can never write
}
function canDelete(role /* , bucket */) {
  return role === 'service_role';                       // deletes are privileged in v1
}

// Managing buckets themselves (create/set-visibility) is service-role only.
const canManageBuckets = (role) => role === 'service_role';

module.exports = { ROLES, VISIBILITY, canRead, canList, canWrite, canDelete, canManageBuckets };
