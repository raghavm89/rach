'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { makeRegistry } = require('../src/registry');
const { createFunctionsServer } = require('../index');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();

async function reg() {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  const r = makeRegistry({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await r.ensureSchema();
  return r;
}

test('registry deploy upserts + bumps version; get/list/remove; validates name/code', { skip: !HAVE_PGLITE }, async () => {
  const r = await reg();
  const v1 = await r.deploy({ name: 'hello', code: 'export default () => "hi"' });
  assert.equal(v1.version, 1);
  const v2 = await r.deploy({ name: 'hello', code: 'export default () => "hi2"', secrets: { K: 'v' } });
  assert.equal(v2.version, 2);
  assert.equal((await r.get('hello')).secrets.K, 'v');
  assert.equal((await r.list()).length, 1);
  assert.equal(await r.remove('hello'), true);
  assert.equal(await r.remove('hello'), false);
  await assert.rejects(() => r.deploy({ name: 'Bad Name', code: 'x' }), /invalid_function_name/);
  await assert.rejects(() => r.deploy({ name: 'ok', code: '' }), /code_required/);
});

test('registry secrets: set/list (digest only)/delete + secretsMap for the runner', { skip: !HAVE_PGLITE }, async () => {
  const r = await reg();
  assert.equal(await r.setSecrets([{ name: 'API_KEY', value: 'sk_123' }, { name: 'bad name', value: 'x' }]), 1); // invalid name dropped
  const list = await r.listSecrets();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'API_KEY');
  assert.ok(list[0].digest && list[0].value === undefined);              // value never exposed
  assert.equal((await r.secretsMap()).API_KEY, 'sk_123');                // runner gets the value
  // upsert replaces value + digest
  const d1 = (await r.listSecrets())[0].digest;
  await r.setSecrets([{ name: 'API_KEY', value: 'sk_456' }]);
  assert.notEqual((await r.listSecrets())[0].digest, d1);
  assert.equal(await r.deleteSecret('API_KEY'), true);
  assert.equal((await r.listSecrets()).length, 0);
});

function listen(s) { return new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port))); }
function call(port, method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) => { let b = ''; res.on('data', (d) => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, body: b })); });
    req.on('error', reject); if (body) req.end(JSON.stringify(body)); else req.end();
  });
}

test('server: deploy is service_role-gated; invoke dispatches to the runner (503 when unset)', { skip: !HAVE_PGLITE }, async () => {
  const registry = await reg();
  // dummy Deno runner that echoes the dispatch
  const runner = http.createServer((req, res) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ran: true, got: JSON.parse(b) })); }); });
  const runnerPort = await listen(runner);

  const srv = createFunctionsServer({ ref: 'p0123456789abcdef', secret: 's', registry, runnerUrl: `http://127.0.0.1:${runnerPort}` });
  const port = await listen(srv);

  // anon can't deploy
  assert.equal((await call(port, 'POST', '/v1/deploy', { 'x-baas-role': 'anon', 'content-type': 'application/json' }, { name: 'f', code: 'x' })).status, 403);
  // service_role deploys
  assert.equal((await call(port, 'POST', '/v1/deploy', { 'x-baas-role': 'service_role', 'content-type': 'application/json' }, { name: 'greet', code: 'export default()=>1', secrets: { S: '1' } })).status, 201);
  // invoke dispatches code+secrets+identity to the runner
  const inv = await call(port, 'POST', '/v1/greet', { 'x-baas-role': 'anon', 'content-type': 'application/json' }, { name: 'world' });
  assert.equal(inv.status, 200);
  const echoed = JSON.parse(inv.body);
  assert.equal(echoed.got.code, 'export default()=>1');
  assert.equal(echoed.got.secrets.S, '1');
  assert.equal(echoed.got.identity.role, 'anon');
  // unknown function → 404
  assert.equal((await call(port, 'POST', '/v1/nope', { 'x-baas-role': 'anon' })).status, 404);

  srv.close(); runner.close();
});
