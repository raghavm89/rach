'use strict';

/**
 * BaaS Storage HTTP server. Behind the per-project gateway at /storage/v1/*. Bucket metadata in
 * the project DB; object bytes in SeaweedFS (SEAWEEDFS_FILER_URL). The caller's role is the
 * gateway-forwarded `x-baas-role` (internal), or a signed URL for direct GET.
 *
 * Env: PROJECT_REF, PROJECT_JWT_SECRET, DATABASE_URL, SEAWEEDFS_FILER_URL, PORT (8080).
 * Routes (gateway strips /storage): POST /v1/bucket · GET /v1/bucket · PUT|GET|DELETE /v1/object/:bucket/:key
 */

require('dotenv').config();
const http = require('http');
const policy = require('./src/policy');
const signed = require('./src/signedUrl');
const { makeStore } = require('./src/store');
const { roleFromRequest } = require('./src/internalToken');

const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body ?? {})); };
const readJson = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { r(b ? JSON.parse(b) : {}); } catch { r(null); } }); });

// /v1/object/mybucket/path/to/key → { bucket, key }
function parseObject(pathname) {
  const m = /^\/v1\/object\/([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\/(.+)$/.exec(pathname);
  return m ? { bucket: m[1], key: m[2] } : null;
}

// Physical object path on the SHARED SeaweedFS filer. Bucket metadata is per-project (each
// baas-storage runs against its own project DB), but the filer is one cluster for every
// project — so the path MUST be namespaced by project ref, or two projects that both create a
// bucket named e.g. `avatars` would read and overwrite each other's objects. `_local` is used
// only in standalone/dev where no ref is set (single-tenant), never in the provisioned path.
function filerObjectPath(ref, bucket, key) {
  const ns = String(ref || '').trim() || '_local';
  return `/buckets/${ns}/${bucket}/${key}`;
}

// Request handler (so it can run standalone OR mounted in the combined baas-services container).
// `maxObjectBytes` (FILE_SIZE_LIMIT) caps uploads; 0/absent = uncapped (dev only — the control
// plane always exports a limit into provisioned containers).
function makeStorageHandler({ ref, secret, store, filerUrl, maxObjectBytes = 0 }) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/' || url.pathname === '/healthz') return send(res, 200, { service: 'baas-storage', ref: ref || null, ready: Boolean(store) });
      if (!store) return send(res, 503, { error: 'STORAGE_NOT_CONFIGURED' });
      // Role comes from the gateway's VERIFIED internal token, never the spoofable
      // x-baas-role header (see src/internalToken.js; go-live audit M3).
      const role = roleFromRequest(req, { secret, ref });

      // Bucket management (service_role only)
      if (url.pathname === '/v1/bucket') {
        if (req.method === 'POST') {
          if (!policy.canManageBuckets(role)) return send(res, 403, { error: 'forbidden' });
          const body = await readJson(req); if (!body?.name) return send(res, 400, { error: 'name_required' });
          try { return send(res, 201, { bucket: await store.createBucket(body.name, body.visibility) }); }
          catch (e) { return send(res, 400, { error: e.message }); }
        }
        // Listing is filtered by what the caller may READ — `anon` used to receive every
        // bucket's name + visibility, private ones included (go-live audit #3, low list).
        if (req.method === 'GET') {
          const buckets = (await store.listBuckets()).filter((b) => policy.canRead(role, b));
          return send(res, 200, { buckets });
        }
        return send(res, 405, { error: 'method_not_allowed' });
      }

      // Mint a time-limited signed link: POST /v1/sign/:bucket/:key { ttl_seconds? }.
      // This endpoint DIDN'T EXIST — signed URLs could be verified but never issued, so the
      // feature was dead end-to-end (go-live audit #3). Minting requires a role that can read
      // the bucket, and never `anon` (for public buckets a plain URL already works; for
      // private ones the mint IS the sharing decision). The returned `path` is
      // gateway-relative; prepend the project URL (https://<ref>.rachbase.app).
      if (req.method === 'POST' && url.pathname.startsWith('/v1/sign/')) {
        const obj = parseObject('/v1/object/' + url.pathname.slice('/v1/sign/'.length));
        if (!obj) return send(res, 400, { error: 'bad_object_path' });
        const bucket = await store.getBucket(obj.bucket);
        if (!bucket) return send(res, 404, { error: 'bucket_not_found' });
        if (role === 'anon' || !policy.canRead(role, bucket)) return send(res, 403, { error: 'forbidden' });
        if (!secret) return send(res, 503, { error: 'SIGNING_NOT_CONFIGURED' });
        const body = (await readJson(req)) || {};
        const ttlSec = Math.min(Math.max(Number(body.ttl_seconds) || 300, 30), 7 * 24 * 3600); // 30s … 7d
        const { exp, sig } = signed.sign(secret, { bucket: obj.bucket, key: obj.key, method: 'GET', ttlSec });
        return send(res, 201, {
          bucket: obj.bucket, key: obj.key, exp,
          path: `/storage/v1/object/${obj.bucket}/${obj.key}?exp=${exp}&sig=${encodeURIComponent(sig)}`,
        });
      }

      // Object operations
      const obj = parseObject(url.pathname);
      if (obj) {
        const bucket = await store.getBucket(obj.bucket);
        if (!bucket) return send(res, 404, { error: 'bucket_not_found' });

        // A valid signed URL authorizes a GET regardless of role.
        const q = url.searchParams;
        const signedOk = req.method === 'GET' && q.get('sig') && signed.verify(secret, { bucket: obj.bucket, key: obj.key, method: 'GET', exp: q.get('exp'), sig: q.get('sig') });

        const allowed = req.method === 'GET' ? (signedOk || policy.canRead(role, bucket))
          : req.method === 'PUT' ? policy.canWrite(role, bucket)
          : req.method === 'DELETE' ? policy.canDelete(role, bucket) : false;
        if (!allowed) return send(res, 403, { error: 'forbidden' });

        if (!filerUrl) return send(res, 503, { error: 'OBJECT_STORE_NOT_PROVISIONED' });

        // Enforce the plan's object-size limit on uploads. FILE_SIZE_LIMIT was configured,
        // billed for… and never read — PUT streamed unbounded bodies straight into the shared
        // filer, so one client could fill it for every project (go-live audit F15). Reject a
        // too-large declared length up front, and count the actual bytes too (chunked
        // encoding, or a client lying about content-length).
        if (req.method === 'PUT' && maxObjectBytes > 0) {
          const declared = Number(req.headers['content-length']);
          if (Number.isFinite(declared) && declared > maxObjectBytes) {
            return send(res, 413, { error: 'payload_too_large', limit_bytes: maxObjectBytes });
          }
        }

        // Proxy to the SeaweedFS filer, namespaced by project ref so tenants are isolated
        // on the shared filer: /buckets/<ref>/<bucket>/<key>
        const target = new URL(filerObjectPath(ref, obj.bucket, obj.key), filerUrl);
        const preq = http.request(target, { method: req.method, headers: { ...req.headers, host: target.host } }, (pr) => { res.writeHead(pr.statusCode, pr.headers); pr.pipe(res); });
        preq.on('error', () => { if (!res.headersSent) send(res, 502, { error: 'object_store_unreachable' }); });
        if (req.method === 'PUT' && maxObjectBytes > 0) {
          let received = 0;
          req.on('data', (chunk) => {
            received += chunk.length;
            if (received > maxObjectBytes) {
              preq.destroy(new Error('payload_too_large')); // aborts the filer write mid-stream
              if (!res.headersSent) send(res, 413, { error: 'payload_too_large', limit_bytes: maxObjectBytes });
              req.destroy();
            }
          });
        }
        return req.pipe(preq);
      }
      return send(res, 404, { error: 'not_found' });
    } catch (e) { return send(res, 500, { error: 'internal', message: e.message }); }
  };
}
function createStorageServer(opts) { return http.createServer(makeStorageHandler(opts)); }

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // An idle-client error EMITS on the pool; unhandled, it crashes the whole process — a DB
  // blip used to take every project's storage down at once (go-live audit F14).
  pool.on('error', (err) => console.error('[baas-storage] pg pool error (continuing):', err.message));
  const store = makeStore(pool);
  await store.ensureSchema();
  const server = createStorageServer({
    ref: process.env.PROJECT_REF || '', secret: process.env.PROJECT_JWT_SECRET || '', store,
    filerUrl: process.env.SEAWEEDFS_FILER_URL || null,
    maxObjectBytes: Number(process.env.FILE_SIZE_LIMIT) || 0,
  });
  server.listen(Number(process.env.PORT) || 8080, () => console.log(`[baas-storage] ref=${process.env.PROJECT_REF || '?'} up`));
  // Graceful shutdown: with replicas:1, a hard kill on every rollout was a per-project
  // outage with dropped in-flight requests (audit F14).
  const shutdown = () => { console.log('[baas-storage] shutting down'); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
if (require.main === module) main().catch((e) => { console.error('[baas-storage] fatal:', e.message); process.exit(1); });

module.exports = { createStorageServer, makeStorageHandler, filerObjectPath };
