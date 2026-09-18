'use strict';

/**
 * Real mTLS + short-lived-JWT transport, tested against a LOCAL MOCK GATEWAY that
 * validates exactly the way SpaceArk's edge will: it requires a trusted client cert
 * (mTLS) and a valid RS256 JWT (aud/iss/exp), and returns 202. This proves the whole
 * transport end-to-end; only pointing at the real SITE_API_URL awaits SpaceArk.
 *
 * Certs are generated with openssl into a temp dir at load; the server is torn down
 * by the final test. Portable SAN via an openssl config file (LibreSSL + OpenSSL).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitetls-'));
const p = (f) => path.join(dir, f);
const read = (f) => fs.readFileSync(p(f), 'utf8');
const run = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' });

// Portable server cert with SAN=localhost via a config file.
fs.writeFileSync(p('srv.cnf'), [
  '[req]', 'distinguished_name=dn', 'x509_extensions=v3', 'prompt=no',
  '[dn]', 'CN=localhost',
  '[v3]', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
].join('\n'));

run('openssl req -x509 -newkey rsa:2048 -nodes -keyout server.key -out server.crt -days 1 -config srv.cnf');
run('openssl req -x509 -newkey rsa:2048 -nodes -keyout client.key -out client.crt -days 1 -subj "/CN=rachbase-bff"');
run('openssl genrsa -out oauth.key 2048');
run('openssl rsa -in oauth.key -pubout -out oauth.pub');

// Point the BFF client at our fixtures (read at call time by siteAuth/siteClient). Only the
// SHARED partner identity lives in env now (mTLS client cert/key + OAuth key); the per-site
// URL/trust-anchor/audience/issuer come from a `site` object (as the registry would supply).
Object.assign(process.env, {
  SITE_ID: 'site1',
  OAUTH_CLIENT_ID: 'rachbase-bff',
  MTLS_CERT_FILE: p('client.crt'),
  MTLS_KEY_FILE: p('client.key'),
  OAUTH_PRIVATE_KEY_FILE: p('oauth.key'),
});

// Mock SpaceArk gateway: enforce mTLS (trusted client cert) + verify the JWT.
const server = https.createServer(
  { cert: read('server.crt'), key: read('server.key'), requestCert: true, rejectUnauthorized: true, ca: [read('client.crt')] },
  (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    try {
      jwt.verify(token, read('oauth.pub'), { algorithms: ['RS256'], audience: 'spaceark-site-api:site1', issuer: 'https://issuer.rachbase.test' });
    } catch {
      res.writeHead(401, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'UNAUTHENTICATED' }));
    }
    if (!req.headers['idempotency-key']) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end('{}'); }
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      res.writeHead(202, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ operationId: 'op-mock', siteId: 'site1', resourceId: 't-mock', state: 'ACCEPTED', statusUrl: '/v1/operations/op-mock' }));
    });
  },
);

// The site as the registry would resolve it (set once we know the ephemeral port).
let site;
const listening = new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    site = {
      siteId: 'site1',
      apiUrl: `https://localhost:${server.address().port}`,
      audience: 'spaceark-site-api:site1',
      issuer: 'https://issuer.rachbase.test',
      ca: read('server.crt'), // trust the server's self-signed cert
    };
    resolve();
  });
});
server.unref();

const { deliver } = require('../src/services/siteClient');
const { hasPartnerCreds } = require('../src/services/siteAuth');

test('partner creds present → real transport selected', () => {
  assert.equal(hasPartnerCreds(), true);
});

test('mTLS + JWT transport delivers to the resolved site and gets a 202 ack', async () => {
  await listening;
  const row = { method: 'PUT', route: '/v1/tenants/t-abcd1234', idempotency_key: 'IDEMP1', payload: { plan: 'pro' } };
  const res = await deliver(row, { site });
  assert.equal(res.status, 202, JSON.stringify(res));
  assert.equal(res.ack, true);
  assert.equal(res.body.state, 'ACCEPTED');
});

test('a JWT with the wrong (per-site) audience is rejected (401 → no ack)', async () => {
  await listening;
  const res = await deliver(
    { method: 'PUT', route: '/v1/tenants/t-abcd1234', idempotency_key: 'IDEMP2', payload: {} },
    { site: { ...site, audience: 'spaceark-site-api:WRONG' } },
  );
  assert.equal(res.status, 401);
  assert.equal(res.ack, false);
});

test('shutdown mock gateway', () => {
  server.close();
});
