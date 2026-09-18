'use strict';

/**
 * Edge Functions client — over `<url>/functions/v1`. `invoke(name, { body })` dispatches to the
 * function runner (POST /v1/:name) and returns `{ data, error }`.
 */

class FunctionsClient {
  constructor(ctx) { this._ctx = ctx; }

  async invoke(name, { body, headers } = {}) {
    const isJson = body != null && typeof body === 'object' && !(body instanceof ArrayBuffer);
    let res;
    try {
      res = await this._ctx.fetch(`${this._ctx.url}/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: this._ctx.headers({ ...(isJson ? { 'Content-Type': 'application/json' } : {}), ...(headers || {}) }),
        body: body == null ? undefined : (isJson ? JSON.stringify(body) : body),
      });
    } catch (e) { return { data: null, error: { message: e.message, status: 0 } }; }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) return { data: null, error: { message: (data && data.message) || `HTTP ${res.status}`, status: res.status, context: data } };
    return { data, error: null };
  }
}

module.exports = { FunctionsClient };
