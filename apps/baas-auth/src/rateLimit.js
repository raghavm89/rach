'use strict';

/**
 * In-memory sliding-window rate limiter for the Auth service's sensitive endpoints (login, signup,
 * OAuth token/consent). Keyed by client IP. Best-effort per-instance (no shared store) — enough to
 * blunt brute-force + abuse. Points/window come from the project's rate-limit config. Injectable
 * clock for tests.
 */
function makeLimiter({ points, windowMs, now = () => Date.now() }) {
  const hits = new Map(); // key -> sorted timestamps within the window
  return {
    hit(key) {
      const t = now();
      const cutoff = t - windowMs;
      const arr = (hits.get(key) || []).filter((x) => x > cutoff);
      if (arr.length >= points) {
        hits.set(key, arr);
        return { allowed: false, retryAfterMs: Math.max(0, arr[0] + windowMs - t) };
      }
      arr.push(t);
      hits.set(key, arr);
      if (hits.size > 10_000) { for (const [k, v] of hits) if (!v.length || v[v.length - 1] < cutoff) hits.delete(k); }
      return { allowed: true, remaining: points - arr.length };
    },
  };
}

// Best-effort client IP: the edge/gateway forwards X-Forwarded-For; fall back to the socket.
function clientIp(req) {
  const xff = req.headers && req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { makeLimiter, clientIp };
