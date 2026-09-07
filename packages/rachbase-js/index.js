'use strict';

/**
 * @rachbase/js — a supabase-js-shaped client for the RachBase BaaS.
 *
 *   import { createClient } from '@rachbase/js';
 *   const db = createClient('https://<ref>.rachbase.app', '<publishable-key>');
 *   const { data, error } = await db.from('todos').select('*').eq('done', false);
 *   await db.auth.signInWithPassword({ email, password });
 *   db.channel('room1').on('broadcast', { event: 'msg' }, cb).subscribe();
 *
 * Migrating from Supabase: change the import + the URL/key — the data (PostgREST), auth, storage,
 * functions, and realtime surfaces mirror supabase-js.
 */

const { QueryBuilder } = require('./src/rest');
const { AuthClient } = require('./src/auth');
const { StorageClient } = require('./src/storage');
const { FunctionsClient } = require('./src/functions');
const { RealtimeClient } = require('./src/realtime');

const trim = (s) => String(s || '').replace(/\/+$/, '');
function refFromUrl(u) { try { const parts = new URL(u).hostname.split('.'); return parts.length > 2 ? parts[0] : null; } catch { return null; } }
const defaultStorage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

function createClient(baseUrl, key, opts = {}) {
  const url = trim(baseUrl);
  const fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!fetchImpl) throw new Error('@rachbase/js: no fetch available — pass opts.fetch on Node < 18');

  const urls = {
    rest: `${url}/rest/v1`,
    auth: `${url}/auth/v1`,
    storage: `${url}/storage/v1`,
    functions: `${url}/functions/v1`,
  };

  const auth = new AuthClient({ url: urls.auth, key, fetch: fetchImpl, storage: (opts.auth && opts.auth.storage) || defaultStorage() });
  const headers = (extra) => ({ apikey: key, Authorization: `Bearer ${auth.currentAccessToken()}`, ...(extra || {}) });

  const restCtx = { urls: { rest: urls.rest }, fetch: fetchImpl, headers };
  const storageClient = new StorageClient({ url: urls.storage, fetch: fetchImpl, headers });
  const functionsClient = new FunctionsClient({ url: urls.functions, fetch: fetchImpl, headers });

  const ref = opts.ref || refFromUrl(url);
  // NOTE (realtime audit #8): realtime is served by the RachBase API host (the control
  // plane), NOT by the per-project gateway host — the project-URL default below only works
  // once the gateway proxies /realtime/v1 (planned). Until then pass
  // `realtimeUrl: 'wss://api.rachbase.com/realtime/v1'` (or your API host) explicitly.
  const realtimeBase = opts.realtimeUrl || `${url.replace(/^http/, 'ws')}/realtime/v1`;
  const getWsUrl = () => `${realtimeBase}?ref=${encodeURIComponent(ref || '')}&token=${encodeURIComponent(auth.currentAccessToken())}`;
  const realtime = new RealtimeClient({ getWsUrl, WebSocketImpl: opts.WebSocket });

  return {
    from: (table) => new QueryBuilder(restCtx, table),
    auth,
    storage: storageClient,
    functions: functionsClient,
    channel: (topic) => realtime.channel(topic),
    removeAllChannels: () => realtime.removeAllChannels(),
    realtime,
    _urls: urls,
  };
}

module.exports = { createClient };
