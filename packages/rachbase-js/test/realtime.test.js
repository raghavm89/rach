'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSubscribeConfig, RealtimeClient } = require('../src/realtime');

test('buildSubscribeConfig maps bindings to the wire config', () => {
  const cfg = buildSubscribeConfig([
    { type: 'postgres_changes', filter: { event: 'INSERT', table: 'todos', filter: 'done=eq.false' } },
    { type: 'presence', filter: { key: 'u1' } },
    { type: 'broadcast', filter: { event: 'msg' } },
  ]);
  assert.deepEqual(cfg.postgres_changes, [{ event: 'INSERT', schema: 'public', table: 'todos', filter: 'done=eq.false' }]);
  assert.deepEqual(cfg.presence, { key: 'u1' });
});

test('channel: subscribe is sent, and server messages dispatch to the right bindings', () => {
  const instances = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; instances.push(this); }
    set onopen(f) { this._o = f; if (f) f(); } get onopen() { return this._o; }   // open synchronously
    set onmessage(f) { this._m = f; } get onmessage() { return this._m; }
    set onclose(f) {} set onerror(f) {}
    send(m) { this.sent.push(JSON.parse(m)); }
    close() {}
    emit(msg) { if (this._m) this._m({ data: JSON.stringify(msg) }); }
  }

  const rt = new RealtimeClient({ getWsUrl: () => 'ws://x/realtime/v1?ref=r&token=t', WebSocketImpl: FakeWS });
  const got = [];
  const statuses = [];
  rt.channel('room1')
    .on('broadcast', { event: 'msg' }, (p) => got.push(['bc', p.payload]))
    .on('postgres_changes', { event: '*', table: 'todos' }, (c) => got.push(['pc', c.eventType]))
    .subscribe((s) => statuses.push(s));

  const ws = instances[0];
  assert.equal(ws.sent[0].type, 'subscribe');
  assert.equal(ws.sent[0].topic, 'room1');
  assert.ok(ws.sent[0].config.postgres_changes.length === 1);

  ws.emit({ type: 'subscribed', topic: 'room1' });
  ws.emit({ type: 'broadcast', topic: 'room1', event: 'msg', payload: { hi: 1 } });
  ws.emit({ type: 'broadcast', topic: 'room1', event: 'other', payload: {} });      // filtered out (event != msg)
  ws.emit({ type: 'postgres_changes', topic: 'room1', event: 'INSERT', table: 'todos', new: { id: 1 } });

  assert.deepEqual(statuses, ['SUBSCRIBED']);
  assert.deepEqual(got, [['bc', { hi: 1 }], ['pc', 'INSERT']]);
});

test('channel.send emits a broadcast frame', () => {
  const instances = [];
  class FakeWS { constructor(u) { this.url = u; this.sent = []; instances.push(this); } set onopen(f) { if (f) f(); } set onmessage(f) {} set onclose(f) {} set onerror(f) {} send(m) { this.sent.push(JSON.parse(m)); } close() {} }
  const rt = new RealtimeClient({ getWsUrl: () => 'ws://x', WebSocketImpl: FakeWS });
  const ch = rt.channel('room1').subscribe();
  ch.send({ type: 'broadcast', event: 'cursor', payload: { x: 1 } });
  const frame = instances[0].sent.find((m) => m.type === 'broadcast');
  assert.deepEqual(frame, { type: 'broadcast', topic: 'room1', event: 'cursor', payload: { x: 1 } });
});
