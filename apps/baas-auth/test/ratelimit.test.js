'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeLimiter, clientIp } = require('../src/rateLimit');

test('allows up to `points` per window, then blocks with a retry-after', () => {
  let t = 1_000_000;
  const lim = makeLimiter({ points: 3, windowMs: 60_000, now: () => t });
  assert.equal(lim.hit('ip1').allowed, true);
  assert.equal(lim.hit('ip1').allowed, true);
  assert.equal(lim.hit('ip1').allowed, true);
  const blocked = lim.hit('ip1');
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 60_000);
  // a different key is independent
  assert.equal(lim.hit('ip2').allowed, true);
  // after the window slides, it allows again
  t += 60_001;
  assert.equal(lim.hit('ip1').allowed, true);
});

test('clientIp prefers X-Forwarded-For, else the socket', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} }), '1.2.3.4');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } }), '9.9.9.9');
  assert.equal(clientIp({ headers: {}, socket: {} }), 'unknown');
});
