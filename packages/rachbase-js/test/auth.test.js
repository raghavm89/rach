'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AuthClient } = require('../src/auth');

const mockFetch = (handler) => async (u, o) => {
  const r = await handler(u, o);
  return { ok: r.status < 400, status: r.status, text: async () => JSON.stringify(r.body) };
};

test('before sign-in, the access token is the anon key', () => {
  const a = new AuthClient({ url: 'x', key: 'anon', fetch: async () => {} });
  assert.equal(a.currentAccessToken(), 'anon');
});

test('signInWithPassword stores the session + token and fires onAuthStateChange', async () => {
  const events = [];
  const a = new AuthClient({
    url: 'https://x/auth/v1', key: 'anon',
    fetch: mockFetch(async (u) => { assert.match(u, /\/token\?grant_type=password$/); return { status: 200, body: { access_token: 'AT', refresh_token: 'RT', user: { id: 1, email: 'a@b.c' } } }; }),
  });
  a.onAuthStateChange((e) => events.push(e));
  const { data, error } = await a.signInWithPassword({ email: 'a@b.c', password: 'pw' });
  assert.equal(error, null);
  assert.equal(data.session.access_token, 'AT');
  assert.equal(data.user.email, 'a@b.c');
  assert.equal(a.currentAccessToken(), 'AT'); // now requests authenticate as the user
  assert.deepEqual(events, ['SIGNED_IN']);
});

test('signOut clears the session', async () => {
  const a = new AuthClient({ url: 'https://x/auth/v1', key: 'anon', fetch: mockFetch(async () => ({ status: 200, body: {} })) });
  a._setSession({ access_token: 'AT' });
  await a.signOut();
  assert.equal(a.currentAccessToken(), 'anon');
  assert.equal(a.getSession().data.session, null);
});

test('deleteUser (erasure) deletes then clears the session', async () => {
  const a = new AuthClient({ url: 'https://x/auth/v1', key: 'anon', fetch: mockFetch(async (u, o) => { assert.equal(o.method, 'DELETE'); assert.match(u, /\/user$/); return { status: 200, body: { deleted: 5 } }; }) });
  a._setSession({ access_token: 'AT' });
  const { data, error } = await a.deleteUser();
  assert.equal(error, null);
  assert.equal(data.deleted, 5);
  assert.equal(a.currentAccessToken(), 'anon'); // session cleared after erasure
});

test('exportData (access) GETs /user/export', async () => {
  const a = new AuthClient({ url: 'https://x/auth/v1', key: 'anon', fetch: mockFetch(async (u) => { assert.match(u, /\/user\/export$/); return { status: 200, body: { user: { email: 'a@b.c' }, exported_at: 'now' } }; }) });
  const { data } = await a.exportData();
  assert.equal(data.user.email, 'a@b.c');
});

test('an auth error returns { error }, no session', async () => {
  const a = new AuthClient({ url: 'https://x/auth/v1', key: 'anon', fetch: mockFetch(async () => ({ status: 400, body: { error: 'invalid_credentials' } })) });
  const { data, error } = await a.signInWithPassword({ email: 'a', password: 'b' });
  assert.equal(data.session, null);
  assert.equal(error.status, 400);
  assert.equal(error.message, 'invalid_credentials');
});
