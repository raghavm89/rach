'use strict';

/**
 * Realtime client — supabase-js-shaped channels over the RachBase WS protocol (/realtime/v1).
 *   channel(topic)
 *     .on('postgres_changes', { event, schema, table, filter }, cb)
 *     .on('broadcast', { event }, cb)
 *     .on('presence', { event }, cb)              // event: 'sync' | 'join' | 'leave'
 *     .subscribe(statusCb?)
 *     .send({ type:'broadcast', event, payload }) // broadcast to the topic
 *     .track(state) / .untrack()                  // presence
 *
 * The WS auth is `?ref=<project-ref>&token=<jwt>`. `getWsUrl()` is called at connect time so the
 * token is current. `WebSocketImpl` is injectable (defaults to the global WebSocket).
 */

// Pure: bindings → the `subscribe` config the server expects (unit-tested).
function buildSubscribeConfig(bindings) {
  const pc = bindings
    .filter((b) => b.type === 'postgres_changes')
    .map((b) => ({ event: (b.filter && b.filter.event) || '*', schema: (b.filter && b.filter.schema) || 'public', table: b.filter && b.filter.table, ...(b.filter && b.filter.filter ? { filter: b.filter.filter } : {}) }));
  const presence = bindings.find((b) => b.type === 'presence');
  const config = {};
  if (pc.length) config.postgres_changes = pc;
  if (presence) config.presence = { key: (presence.filter && presence.filter.key) || undefined };
  return config;
}

class RealtimeChannel {
  constructor(client, topic) { this._client = client; this._topic = topic; this._bindings = []; this._statusCb = null; this._joined = false; }

  on(type, filter, cb) {
    if (typeof filter === 'function') { cb = filter; filter = {}; }
    this._bindings.push({ type, filter: filter || {}, cb });
    return this;
  }

  subscribe(statusCb) {
    this._statusCb = statusCb || null;
    this._client._ensureConnected();
    this._client._register(this);
    this._client._send({ type: 'subscribe', topic: this._topic, config: buildSubscribeConfig(this._bindings) });
    return this;
  }

  send(msg) { // { type:'broadcast', event, payload }
    this._client._send({ type: 'broadcast', topic: this._topic, event: msg.event, payload: msg.payload });
    return this;
  }
  track(state, key) { this._client._send({ type: 'presence', topic: this._topic, event: 'track', key, state }); return this; }
  untrack(key) { this._client._send({ type: 'presence', topic: this._topic, event: 'untrack', key }); return this; }
  unsubscribe() { this._client._send({ type: 'unsubscribe', topic: this._topic }); this._client._unregister(this); return this; }

  _dispatch(msg) {
    if (msg.type === 'subscribed') { this._joined = true; if (this._statusCb) this._statusCb('SUBSCRIBED'); return; }
    for (const b of this._bindings) {
      if (b.type === 'postgres_changes' && msg.type === 'postgres_changes') {
        const want = b.filter.event || '*';
        if (want === '*' || want === msg.event) b.cb({ eventType: msg.event, schema: msg.schema, table: msg.table, new: msg.new, old: msg.old });
      } else if (b.type === 'broadcast' && msg.type === 'broadcast') {
        if (!b.filter.event || b.filter.event === msg.event) b.cb({ event: msg.event, payload: msg.payload });
      } else if (b.type === 'presence' && (msg.type === 'presence_state' || msg.type === 'presence_diff')) {
        b.cb(msg);
      }
    }
  }
}

class RealtimeClient {
  constructor({ getWsUrl, WebSocketImpl }) {
    this._getWsUrl = getWsUrl;
    this._WS = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
    this._ws = null;
    this._channels = new Map(); // topic → RealtimeChannel
    this._queue = [];
    this._open = false;
  }

  channel(topic) {
    if (this._channels.has(topic)) return this._channels.get(topic);
    const ch = new RealtimeChannel(this, topic);
    return ch;
  }

  _register(ch) { this._channels.set(ch._topic, ch); }
  _unregister(ch) { this._channels.delete(ch._topic); }

  _ensureConnected() {
    if (this._ws || !this._WS) return;
    const url = this._getWsUrl();
    const ws = new this._WS(url);
    this._ws = ws;
    ws.onopen = () => { this._open = true; for (const m of this._queue.splice(0)) ws.send(JSON.stringify(m)); };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString()); } catch { return; }
      const ch = msg.topic && this._channels.get(msg.topic);
      if (ch) ch._dispatch(msg);
    };
    ws.onclose = () => { this._open = false; this._ws = null; };
    ws.onerror = () => { /* surfaced via onclose */ };
  }

  _send(m) {
    this._ensureConnected();
    if (this._open && this._ws) this._ws.send(JSON.stringify(m));
    else this._queue.push(m);
  }

  removeAllChannels() { for (const ch of this._channels.values()) ch.unsubscribe(); if (this._ws) try { this._ws.close(); } catch { /* ignore */ } }
}

module.exports = { RealtimeClient, RealtimeChannel, buildSubscribeConfig };
