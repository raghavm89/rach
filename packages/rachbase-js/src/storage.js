'use strict';

/**
 * Storage client — over `<url>/storage/v1`. Buckets: create/list. Objects: upload/download/remove
 * + a public URL for public buckets. Mirrors the storage service routes
 * (POST|GET /v1/bucket, PUT|GET|DELETE /v1/object/:bucket/:key).
 */

const enc = (p) => String(p).split('/').map(encodeURIComponent).join('/');

class BucketClient {
  constructor(ctx, bucket) { this._ctx = ctx; this._bucket = bucket; }
  _obj(path) { return `${this._ctx.url}/object/${this._bucket}/${enc(path)}`; }

  async upload(path, body, { contentType = 'application/octet-stream', upsert } = {}) {
    const headers = this._ctx.headers({ 'Content-Type': contentType, ...(upsert ? { 'x-upsert': 'true' } : {}) });
    let res;
    try { res = await this._ctx.fetch(this._obj(path), { method: 'PUT', headers, body }); }
    catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}`, status: res.status } };
    return { data: { path: `${this._bucket}/${path}` }, error: null };
  }

  async download(path) {
    let res;
    try { res = await this._ctx.fetch(this._obj(path), { method: 'GET', headers: this._ctx.headers() }); }
    catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
    if (!res.ok) return { data: null, error: { message: `HTTP ${res.status}`, status: res.status } };
    const data = typeof res.blob === 'function' ? await res.blob() : Buffer.from(await res.arrayBuffer());
    return { data, error: null };
  }

  async remove(paths) {
    const list = Array.isArray(paths) ? paths : [paths];
    const results = [];
    for (const p of list) {
      try { const res = await this._ctx.fetch(this._obj(p), { method: 'DELETE', headers: this._ctx.headers() }); results.push({ path: p, ok: res.ok }); }
      catch { results.push({ path: p, ok: false }); }
    }
    const failed = results.filter((r) => !r.ok);
    return failed.length ? { data: results, error: { message: `failed to remove ${failed.length} object(s)` } } : { data: results, error: null };
  }

  getPublicUrl(path) { return { data: { publicUrl: this._obj(path) } }; }
}

class StorageClient {
  constructor(ctx) { this._ctx = ctx; }
  from(bucket) { return new BucketClient(this._ctx, bucket); }

  async createBucket(name, visibility = 'private') {
    const res = await this._ctx.fetch(`${this._ctx.url}/bucket`, { method: 'POST', headers: this._ctx.headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ name, visibility }) });
    const b = await res.json().catch(() => null);
    return res.ok ? { data: b, error: null } : { data: null, error: { message: (b && b.error) || `HTTP ${res.status}`, status: res.status } };
  }
  async listBuckets() {
    const res = await this._ctx.fetch(`${this._ctx.url}/bucket`, { method: 'GET', headers: this._ctx.headers() });
    const b = await res.json().catch(() => null);
    return res.ok ? { data: (b && b.buckets) || [], error: null } : { data: null, error: { message: `HTTP ${res.status}`, status: res.status } };
  }
}

module.exports = { StorageClient, BucketClient };
