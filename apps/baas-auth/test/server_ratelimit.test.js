'use strict';

/** The Auth server enforces per-IP rate limits on sensitive endpoints (login here). */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const baas = require('@rach/baas');
const { createAuthServer } = require('../index');
const { makeStore } = require('../src/store');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

function listen(s) { return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port))); }
function post(port, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'POST', headers: { 'content-type': 'application/json', ...headers } }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, retryAfter: res.headers['retry-after'], body: b }));
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
}

test('login is rate-limited per IP (429 after the configured points)', { skip: !HAVE_PGLITE }, async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const store = makeStore({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await store.ensureSchema();
  const srv = createAuthServer({ ref: 'p0123456789abcdef', secret: baas.generateSecret(), store, config: { rateSigninPer5min: 2 } });
  const port = await listen(srv);

  const h = { 'x-forwarded-for': '5.5.5.5' };
  // wrong creds → 400, but each attempt still counts against the limit
  assert.equal((await post(port, '/v1/token', { email: 'a@b.com', password: 'x' }, h)).status, 400);
  assert.equal((await post(port, '/v1/token', { email: 'a@b.com', password: 'x' }, h)).status, 400);
  const blocked = await post(port, '/v1/token', { email: 'a@b.com', password: 'x' }, h);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.retryAfter) > 0);

  // a different IP is unaffected
  assert.equal((await post(port, '/v1/token', { email: 'a@b.com', password: 'x' }, { 'x-forwarded-for': '6.6.6.6' })).status, 400);

  srv.close();
});
