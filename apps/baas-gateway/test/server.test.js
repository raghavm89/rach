'use strict';

/** End-to-end: the gateway proxies an authenticated request to the upstream (and forwards the
 * verified role/ref), 401s an unauthenticated one, and 503s an unprovisioned primitive. */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const baas = require('@rach/baas');
const { createGatewayServer, makeIntrospector } = require('../index');

const REF = 'p0123456789abcdef';
const SECRET = baas.generateSecret();

function listen(server) { return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port))); }
function req(port, path, method, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b }));
    });
    r.on('error', reject); r.end();
  });
}
const get = (port, path, headers) => req(port, path, 'GET', headers);

test('gateway proxies an authorized request and forwards x-baas-role/ref', async () => {
  // dummy REST upstream that echoes what it received
  const upstream = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ path: req.url, role: req.headers['x-baas-role'], ref: req.headers['x-baas-ref'] })); });
  const upPort = await listen(upstream);

  const gw = createGatewayServer({ ref: REF, secret: SECRET, upstreams: { rest: `http://127.0.0.1:${upPort}` } });
  const gwPort = await listen(gw);

  const anon = baas.mintAnonKey(SECRET, REF);
  const ok = await get(gwPort, '/rest/v1/todos?x=1', { authorization: `Bearer ${anon}` });
  assert.equal(ok.status, 200);
  const echoed = JSON.parse(ok.body);
  assert.equal(echoed.path, '/v1/todos?x=1');   // path preserved, primitive prefix stripped
  assert.equal(echoed.role, 'anon');            // verified role forwarded
  assert.equal(echoed.ref, REF);

  // unauthenticated → 401
  const noauth = await get(gwPort, '/rest/v1/todos', {});
  assert.equal(noauth.status, 401);

  // a primitive with no upstream → 503
  const notprov = await get(gwPort, '/functions/v1/hello', { authorization: `Bearer ${anon}` });
  assert.equal(notprov.status, 503);
  assert.equal(JSON.parse(notprov.body).error, 'PRIMITIVE_NOT_PROVISIONED');

  gw.close(); upstream.close();
});

test('gateway validates an opaque secret key via cached introspection and forwards its role', async () => {
  const upstream = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ role: req.headers['x-baas-role'], ref: req.headers['x-baas-ref'] })); });
  const upPort = await listen(upstream);

  const secretKey = baas.apikeys.generateKey('secret').key;
  let calls = 0;
  // fake control-plane introspection endpoint (what makeIntrospector POSTs to)
  const fetchImpl = async (_url, opts) => {
    calls += 1;
    const { ref, key } = JSON.parse(opts.body);
    const valid = ref === REF && key === secretKey;
    return { ok: true, json: async () => (valid ? { valid: true, role: 'service_role' } : { valid: false }) };
  };
  const introspect = makeIntrospector({ url: 'http://control-plane/introspect', token: 'svc', ttlMs: 60_000, fetchImpl });

  const gw = createGatewayServer({ ref: REF, secret: SECRET, upstreams: { rest: `http://127.0.0.1:${upPort}` }, introspect });
  const gwPort = await listen(gw);

  const a = await get(gwPort, '/rest/v1/todos', { apikey: secretKey });
  assert.equal(a.status, 200);
  assert.equal(JSON.parse(a.body).role, 'service_role');

  // second call with the same key is served from cache (no extra introspection round-trip)
  const b = await get(gwPort, '/rest/v1/todos', { apikey: secretKey });
  assert.equal(b.status, 200);
  assert.equal(calls, 1);

  // an unknown opaque key is rejected (introspection says invalid → 401)
  const bad = await get(gwPort, '/rest/v1/todos', { apikey: 'rb_secret_unknown' });
  assert.equal(bad.status, 401);

  gw.close(); upstream.close();
});

test('CORS: preflight returns 204 with headers; responses carry the allow-origin', async () => {
  const gw = createGatewayServer({ ref: REF, secret: SECRET, upstreams: {} });
  const gwPort = await listen(gw);

  // OPTIONS preflight → 204 + CORS headers, no auth needed
  const pre = await req(gwPort, '/auth/v1/token', 'OPTIONS', { origin: 'https://app.example.com', 'access-control-request-method': 'POST' });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers['access-control-allow-origin'], '*');
  assert.match(pre.headers['access-control-allow-headers'], /authorization/i);

  // a normal (even unauthenticated) response still carries the allow-origin header
  const r = await get(gwPort, '/rest/v1/todos', {});
  assert.equal(r.status, 401);
  assert.equal(r.headers['access-control-allow-origin'], '*');

  gw.close();
});

test('CORS allow-list echoes a matching origin (and only that one)', async () => {
  const gw = createGatewayServer({ ref: REF, secret: SECRET, upstreams: {}, corsOrigins: 'https://app.example.com, https://admin.example.com' });
  const gwPort = await listen(gw);
  const ok = await req(gwPort, '/healthz', 'OPTIONS', { origin: 'https://app.example.com' });
  assert.equal(ok.headers['access-control-allow-origin'], 'https://app.example.com');
  assert.equal(ok.headers['vary'], 'Origin');
  const other = await req(gwPort, '/healthz', 'OPTIONS', { origin: 'https://evil.example.com' });
  assert.notEqual(other.headers['access-control-allow-origin'], 'https://evil.example.com');
  gw.close();
});

test('accepts an ES256 user token and hands the upstream a verifiable internal HS256 token', async () => {
  // upstream verifies the forwarded Authorization with the project secret (what PostgREST/auth do)
  const upstream = http.createServer((req, res) => {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    let claims = null; try { claims = baas.verifyToken(SECRET, m[1], { ref: REF }); } catch { /* invalid */ }
    res.writeHead(claims ? 200 : 401, { 'content-type': 'application/json' });
    res.end(JSON.stringify(claims ? { sub: claims.sub, role: claims.role, apikey: req.headers.apikey || null } : { bad: true }));
  });
  const upPort = await listen(upstream);

  const kp = baas.signing.generateSigningKeypair();
  const userToken = baas.signing.mintUserTokenAsym(kp.privatePem, REF, { sub: 'user-42', kid: kp.kid });

  const gw = createGatewayServer({ ref: REF, secret: SECRET, publicKey: kp.publicPem, kid: kp.kid, upstreams: { rest: `http://127.0.0.1:${upPort}` } });
  const gwPort = await listen(gw);

  const r = await get(gwPort, '/rest/v1/todos', { authorization: `Bearer ${userToken}`, apikey: 'rb_publishable_x' });
  assert.equal(r.status, 200);
  const body = JSON.parse(r.body);
  assert.equal(body.sub, 'user-42');            // identity preserved through the token exchange
  assert.equal(body.role, `authenticated_${REF}`);   // mapped to the per-project DB role for PostgREST
  assert.equal(body.apikey, null);              // apikey header stripped before the upstream

  // JWKS is published for external verifiers
  const jwks = await get(gwPort, '/.well-known/jwks.json', {});
  assert.equal(jwks.status, 200);
  assert.equal(JSON.parse(jwks.body).keys[0].kid, kp.kid);

  gw.close(); upstream.close();
});

test('a SIGNED storage GET passes through with NO credentials — the storage service does the real check (audit #3 close-out)', async () => {
  // Echo upstream standing in for baas-storage: reports the path + auth header it received.
  const upstream = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ path: req.url, hasInternalToken: /^Bearer /.test(req.headers.authorization || ''), role: req.headers['x-baas-role'] }));
  });
  const upPort = await listen(upstream);
  const gw = createGatewayServer({ ref: REF, secret: SECRET, upstreams: { storage: `http://127.0.0.1:${upPort}` } });
  const gwPort = await listen(gw);

  // 1. Credential-less signed GET (what an <img src=…> sends) → passes through as anon.
  const ok = await get(gwPort, '/storage/v1/object/avatars/me.png?exp=9999999999&sig=abc', {});
  assert.equal(ok.status, 200);
  const echoed = JSON.parse(ok.body);
  assert.equal(echoed.path, '/v1/object/avatars/me.png?exp=9999999999&sig=abc'); // sig+exp reach storage for the REAL verify
  assert.equal(echoed.role, 'anon');                                             // no privilege granted by passage
  assert.equal(echoed.hasInternalToken, true);                                   // still carries the anon internal token shape

  // 2. The allowance is NARROW: same URL without sig → 401; non-object storage path → 401;
  //    non-GET with sig → 401; signed path on another primitive → 401.
  assert.equal((await get(gwPort, '/storage/v1/object/avatars/me.png?exp=9999999999', {})).status, 401);
  assert.equal((await get(gwPort, '/storage/v1/bucket?exp=9999999999&sig=abc', {})).status, 401);
  assert.equal((await req(gwPort, '/storage/v1/object/avatars/me.png?exp=9999999999&sig=abc', 'DELETE', {})).status, 401);

  gw.close(); upstream.close();
});
