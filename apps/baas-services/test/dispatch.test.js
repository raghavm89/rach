'use strict';

/** The combined server dispatches by the x-baas-primitive header to the right sub-handler. */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createServicesServer } = require('../index');

function listen(s) { return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port))); }
function get(port, path, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers }, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    req.on('error', reject); req.end();
  });
}

test('routes to the handler named by x-baas-primitive; unknown → 404; health has no primitive', async () => {
  const handlers = {
    auth: (req, res) => { res.writeHead(200); res.end('AUTH'); },
    storage: (req, res) => { res.writeHead(200); res.end('STORAGE'); },
    functions: (req, res) => { res.writeHead(200); res.end('FUNCTIONS'); },
  };
  const srv = createServicesServer({ handlers });
  const port = await listen(srv);

  assert.equal((await get(port, '/v1/signup', { 'x-baas-primitive': 'auth' })).body, 'AUTH');
  assert.equal((await get(port, '/v1/object/b/k', { 'x-baas-primitive': 'storage' })).body, 'STORAGE');
  assert.equal((await get(port, '/v1/deploy', { 'x-baas-primitive': 'functions' })).body, 'FUNCTIONS');

  const unknown = await get(port, '/v1/x', { 'x-baas-primitive': 'realtime' });
  assert.equal(unknown.status, 404);
  assert.match(unknown.body, /unknown_primitive/);

  const missing = await get(port, '/v1/x', {});                 // no primitive header
  assert.equal(missing.status, 404);

  const health = await get(port, '/healthz', {});               // health needs no primitive
  assert.equal(health.status, 200);
  assert.match(health.body, /baas-services/);

  srv.close();
});
