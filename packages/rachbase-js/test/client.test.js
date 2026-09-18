'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../index');

test('createClient wires all surfaces and derives Supabase-style URLs', () => {
  const db = createClient('https://p1.rachbase.app/', 'anonKEY', { fetch: async () => {} });
  assert.equal(db._urls.rest, 'https://p1.rachbase.app/rest/v1');
  assert.equal(db._urls.auth, 'https://p1.rachbase.app/auth/v1');
  assert.equal(db._urls.storage, 'https://p1.rachbase.app/storage/v1');
  assert.equal(db._urls.functions, 'https://p1.rachbase.app/functions/v1');
  assert.equal(typeof db.from, 'function');
  assert.equal(typeof db.auth.signInWithPassword, 'function');
  assert.equal(typeof db.storage.from, 'function');
  assert.equal(typeof db.functions.invoke, 'function');
  assert.equal(typeof db.channel, 'function');
});

test('requests carry apikey + Bearer token (anon key until signed in)', async () => {
  const calls = [];
  const fetchImpl = async (u, o) => { calls.push({ u, headers: o.headers }); return { ok: true, status: 200, text: async () => '[]', headers: { get: () => null } }; };
  const db = createClient('https://p1.rachbase.app', 'anonKEY', { fetch: fetchImpl });

  await db.from('todos').select('*').eq('done', false);
  assert.match(calls[0].u, /\/rest\/v1\/todos\?/);
  assert.equal(calls[0].headers.apikey, 'anonKEY');
  assert.equal(calls[0].headers.Authorization, 'Bearer anonKEY'); // no session yet
});

test('after sign-in, requests switch to the user access token', async () => {
  let stage = 'auth';
  const seen = [];
  const fetchImpl = async (u, o) => {
    if (stage === 'auth') return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: 'USER_JWT', user: { id: 1 } }) };
    seen.push(o.headers.Authorization);
    return { ok: true, status: 200, text: async () => '[]', headers: { get: () => null } };
  };
  const db = createClient('https://p1.rachbase.app', 'anonKEY', { fetch: fetchImpl });
  await db.auth.signInWithPassword({ email: 'a@b.c', password: 'pw' });
  stage = 'rest';
  await db.from('todos').select('*');
  assert.equal(seen[0], 'Bearer USER_JWT');
});

test('functions.invoke posts to /functions/v1/:name', async () => {
  let called = null;
  const fetchImpl = async (u, o) => { called = { u, body: o.body }; return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) }; };
  const db = createClient('https://p1.rachbase.app', 'k', { fetch: fetchImpl });
  const { data, error } = await db.functions.invoke('hello', { body: { name: 'x' } });
  assert.equal(error, null);
  assert.deepEqual(data, { ok: true });
  assert.match(called.u, /\/functions\/v1\/hello$/);
  assert.equal(called.body, JSON.stringify({ name: 'x' }));
});
