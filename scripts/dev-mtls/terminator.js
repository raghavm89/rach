'use strict';

/**
 * Local dev mTLS terminator — stands in for SpaceArk's edge gateway so the production-style
 * BFF ↔ site-controller loop works on one machine. Listens HTTPS on :8443, REQUIRES a trusted
 * client cert (mTLS), and forwards each request as plain HTTP to the `api` facade.
 *
 *   BFF  --https + mTLS-->  terminator (:8443)  --http-->  facade (:8090)
 *
 * Run (from the repo root, after gen-certs.sh):
 *   node scripts/dev-mtls/terminator.js
 * Env:
 *   CERT_DIR        dir holding ca.crt/server.crt/server.key   (default: secrets)
 *   TERMINATOR_PORT the HTTPS port the BFF dials                (default: 8443)
 *   UPSTREAM_PORT   the facade's plain-HTTP API_PORT            (default: 8090)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = process.env.CERT_DIR || 'secrets';
const PORT = Number(process.env.TERMINATOR_PORT) || 8443;
const UP = Number(process.env.UPSTREAM_PORT) || 8090;
const rd = (f) => fs.readFileSync(path.join(DIR, f));

const server = https.createServer(
  { key: rd('server.key'), cert: rd('server.crt'), ca: rd('ca.crt'), requestCert: true, rejectUnauthorized: true },
  (req, res) => {
    const up = http.request(
      { host: '127.0.0.1', port: UP, method: req.method, path: req.url, headers: req.headers },
      (ur) => { res.writeHead(ur.statusCode, ur.headers); ur.pipe(res); },
    );
    up.on('error', (e) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'upstream_unreachable', detail: e.message, upstream: `127.0.0.1:${UP}` }));
    });
    req.pipe(up);
  },
);

server.on('tlsClientError', (e) => console.error('[dev-mtls] client TLS/mTLS rejected:', e.message));
server.listen(PORT, () => console.log(`[dev-mtls] terminator https://localhost:${PORT} → http://127.0.0.1:${UP} (mTLS required)`));
