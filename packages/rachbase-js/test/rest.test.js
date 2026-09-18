'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { QueryBuilder } = require('../src/rest');

const okCtx = {
  urls: { rest: 'https://x.rachbase.app/rest/v1' },
  headers: (e) => ({ apikey: 'k', Authorization: 'Bearer k', ...e }),
  fetch: async () => ({ ok: true, status: 200, text: async () => '[]', headers: { get: () => null } }),
};
const qb = (t, ctx = okCtx) => new QueryBuilder(ctx, t);

test('select + filters + order + limit build a PostgREST URL', () => {
  const f = qb('todos').select('id,title').eq('done', false).order('created_at', { ascending: false }).limit(10);
  const u = new URL(f.toURL());
  assert.equal(u.pathname, '/rest/v1/todos');
  assert.equal(u.searchParams.get('select'), 'id,title');
  assert.equal(u.searchParams.get('done'), 'eq.false');
  assert.equal(u.searchParams.get('order'), 'created_at.desc');
  assert.equal(u.searchParams.get('limit'), '10');
});

test('in() and range() map to PostgREST syntax', () => {
  const u = new URL(qb('t').select('*').in('id', [1, 2, 3]).range(0, 9).toURL());
  assert.equal(u.searchParams.get('id'), 'in.(1,2,3)');
  assert.equal(u.searchParams.get('offset'), '0');
  assert.equal(u.searchParams.get('limit'), '10');
});

test('insert/update/delete use the right verb + Prefer', () => {
  assert.equal(qb('t').insert({ a: 1 })._method, 'POST');
  assert.equal(qb('t').insert({ a: 1 })._headers.Prefer, 'return=representation');
  assert.equal(qb('t').update({ a: 1 })._method, 'PATCH');
  assert.equal(qb('t').delete()._method, 'DELETE');
  assert.match(qb('t').upsert({ a: 1 })._headers.Prefer, /merge-duplicates/);
});

test('awaiting a builder executes and returns {data,error,status}', async () => {
  const r = await qb('t').select('*');
  assert.deepEqual(r.data, []);
  assert.equal(r.error, null);
  assert.equal(r.status, 200);
});

test('HTTP error becomes an error object (no throw)', async () => {
  const errCtx = { ...okCtx, fetch: async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ message: 'bad request' }), headers: { get: () => null } }) };
  const r = await qb('t', errCtx).select('*');
  assert.equal(r.data, null);
  assert.equal(r.error.message, 'bad request');
  assert.equal(r.error.status, 400);
});

test('single() unwraps the first row', async () => {
  const oneCtx = { ...okCtx, fetch: async () => ({ ok: true, status: 200, text: async () => JSON.stringify([{ id: 1 }]), headers: { get: () => null } }) };
  const r = await qb('t', oneCtx).select('*').eq('id', 1).single();
  assert.deepEqual(r.data, { id: 1 });
});
