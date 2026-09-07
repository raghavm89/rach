'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rt = require('../src/realtime');

test('parseClientMessage: validates type + topic', () => {
  assert.equal(rt.parseClientMessage('not json').error, 'invalid_json');
  assert.equal(rt.parseClientMessage(JSON.stringify({ type: 'nope' })).error, 'unknown_type');
  assert.equal(rt.parseClientMessage(JSON.stringify({ type: 'subscribe' })).error, 'topic_required');
  assert.equal(rt.parseClientMessage(JSON.stringify({ type: 'ping' })).type, 'ping'); // ping needs no topic
  const ok = rt.parseClientMessage(JSON.stringify({ type: 'subscribe', topic: 'room:1' }));
  assert.equal(ok.type, 'subscribe');
  assert.equal(ok.topic, 'room:1');
});

test('parseFilter + applyFilter cover the operators', () => {
  assert.deepEqual(rt.parseFilter('id=eq.5'), { column: 'id', op: 'eq', value: '5' });
  assert.equal(rt.parseFilter('bad'), null);
  assert.equal(rt.parseFilter('x=xx.1'), null); // unknown op
  assert.equal(rt.applyFilter({ id: 5 }, rt.parseFilter('id=eq.5')), true);
  assert.equal(rt.applyFilter({ id: 6 }, rt.parseFilter('id=eq.5')), false);
  assert.equal(rt.applyFilter({ n: 10 }, rt.parseFilter('n=gt.5')), true);   // numeric compare
  assert.equal(rt.applyFilter({ n: 3 }, rt.parseFilter('n=gte.3')), true);
  assert.equal(rt.applyFilter({ s: 'hello' }, rt.parseFilter('s=like.hel%')), true);
  assert.equal(rt.applyFilter({ c: 'b' }, rt.parseFilter('c=in.a,b,c')), true);
  assert.equal(rt.applyFilter({}, rt.parseFilter('id=eq.5')), false);        // missing column
  assert.equal(rt.applyFilter({ id: 1 }, null), true);                        // no filter → matches
});

test('parseNotifyPayload validates + normalizes', () => {
  assert.equal(rt.parseNotifyPayload('{bad'), null);
  assert.equal(rt.parseNotifyPayload(JSON.stringify({ type: 'NOPE', table: 't' })), null);
  const c = rt.parseNotifyPayload(JSON.stringify({ type: 'INSERT', table: 'todos', record: { id: 1 } }));
  assert.equal(c.schema, 'public'); // default
  assert.equal(c.table, 'todos');
  assert.equal(c.type, 'INSERT');
  assert.deepEqual(c.record, { id: 1 });
});

test('changeMatchesSubscription honors event/schema/table/filter', () => {
  const change = { schema: 'public', table: 'todos', type: 'INSERT', record: { id: 5, done: false } };
  assert.ok(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: '*', table: 'todos' }] }));
  assert.ok(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: 'INSERT', table: 'todos' }] }));
  assert.equal(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: 'UPDATE', table: 'todos' }] }), null);
  assert.equal(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: '*', table: 'other' }] }), null);
  assert.equal(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: '*', schema: 'auth', table: 'todos' }] }), null);
  assert.ok(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: '*', table: 'todos', filter: 'id=eq.5' }] }));
  assert.equal(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: '*', table: 'todos', filter: 'id=eq.9' }] }), null);
  assert.ok(rt.changeMatchesSubscription(change, { postgres_changes: [{ event: '*', table: '*' }] })); // wildcard table
});

test('buildChangeMessage shapes the client event', () => {
  const change = { schema: 'public', table: 'todos', type: 'UPDATE', record: { id: 1, x: 2 }, old: { id: 1, x: 1 } };
  const msg = rt.buildChangeMessage('room:1', change);
  assert.equal(msg.type, 'postgres_changes');
  assert.equal(msg.event, 'UPDATE');
  assert.equal(msg.topic, 'room:1');
  assert.deepEqual(msg.new, { id: 1, x: 2 });
  assert.deepEqual(msg.old, { id: 1, x: 1 });
});

test('presenceDiff computes joins and leaves', () => {
  const prev = { a: { name: 'A' }, b: { name: 'B' } };
  const next = { b: { name: 'B' }, c: { name: 'C' } };
  const { joins, leaves } = rt.presenceDiff(prev, next);
  assert.deepEqual(Object.keys(joins), ['c']);
  assert.deepEqual(Object.keys(leaves), ['a']);
});
