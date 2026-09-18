'use strict';

/**
 * PostgREST data client — mirrors @supabase/postgrest-js over `<url>/rest/v1`.
 * A builder is THENABLE: `await db.from('t').select('*').eq('done', false)` runs the request and
 * resolves `{ data, error, count, status }`. No throw on HTTP errors — errors come back in `error`.
 */

function addPrefer(existing, add) {
  const parts = (existing ? existing.split(',') : []).map((s) => s.trim()).filter(Boolean);
  for (const a of add.split(',')) if (!parts.includes(a.trim())) parts.push(a.trim());
  return parts.join(',');
}
function countFromHeaders(res) {
  // PostgREST returns Content-Range: 0-9/42 when count is requested.
  const cr = res.headers && res.headers.get && res.headers.get('content-range');
  if (!cr) return null;
  const total = cr.split('/')[1];
  return total && total !== '*' ? Number(total) : null;
}

class FilterBuilder {
  constructor(ctx, { method, table, body, headers }) {
    this._ctx = ctx;
    this._method = method;
    this._table = table;
    this._body = body;
    this._headers = { ...(headers || {}) };
    this._params = new URLSearchParams();
    this._single = false;
  }

  // ── filters (column, value) ──────────────────────────────────────────────
  eq(c, v) { this._params.append(c, `eq.${v}`); return this; }
  neq(c, v) { this._params.append(c, `neq.${v}`); return this; }
  gt(c, v) { this._params.append(c, `gt.${v}`); return this; }
  gte(c, v) { this._params.append(c, `gte.${v}`); return this; }
  lt(c, v) { this._params.append(c, `lt.${v}`); return this; }
  lte(c, v) { this._params.append(c, `lte.${v}`); return this; }
  like(c, v) { this._params.append(c, `like.${v}`); return this; }
  ilike(c, v) { this._params.append(c, `ilike.${v}`); return this; }
  is(c, v) { this._params.append(c, `is.${v}`); return this; }
  in(c, arr) { this._params.append(c, `in.(${arr.join(',')})`); return this; }
  contains(c, v) { this._params.append(c, `cs.${Array.isArray(v) ? `{${v.join(',')}}` : JSON.stringify(v)}`); return this; }
  filter(c, op, v) { this._params.append(c, `${op}.${v}`); return this; }

  // ── modifiers ────────────────────────────────────────────────────────────
  select(cols = '*') {
    this._params.set('select', cols);
    if (this._method !== 'GET') this._headers.Prefer = addPrefer(this._headers.Prefer, 'return=representation');
    return this;
  }
  order(c, { ascending = true, nullsFirst } = {}) {
    const dir = ascending ? 'asc' : 'desc';
    const nulls = nullsFirst == null ? '' : (nullsFirst ? '.nullsfirst' : '.nullslast');
    this._params.append('order', `${c}.${dir}${nulls}`);
    return this;
  }
  limit(n) { this._params.append('limit', String(n)); return this; }
  offset(n) { this._params.append('offset', String(n)); return this; }
  range(from, to) { this._params.append('offset', String(from)); this._params.append('limit', String(to - from + 1)); return this; }
  single() { this._single = true; this._headers.Accept = 'application/vnd.pgrst.object+json'; return this; }
  maybeSingle() { this._single = 'maybe'; return this; }

  toURL() {
    const qs = this._params.toString();
    return `${this._ctx.urls.rest}/${this._table}${qs ? `?${qs}` : ''}`;
  }

  async _run() {
    const url = this.toURL();
    const headers = this._ctx.headers({ 'Content-Type': 'application/json', ...this._headers });
    let res;
    try {
      res = await this._ctx.fetch(url, {
        method: this._method,
        headers,
        body: this._body != null ? JSON.stringify(this._body) : undefined,
      });
    } catch (e) {
      return { data: null, error: { message: e.message, details: null, status: 0 }, status: 0, count: null };
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      return { data: null, error: { message: (data && data.message) || text || `HTTP ${res.status}`, details: data, status: res.status }, status: res.status, count: null };
    }
    if (this._single && Array.isArray(data)) data = data.length ? data[0] : null;
    return { data, error: null, status: res.status, count: countFromHeaders(res) };
  }

  then(resolve, reject) { return this._run().then(resolve, reject); }
  catch(reject) { return this._run().catch(reject); }
}

class QueryBuilder {
  constructor(ctx, table) { this._ctx = ctx; this._table = table; }
  select(cols = '*') { const f = new FilterBuilder(this._ctx, { method: 'GET', table: this._table }); f._params.set('select', cols); return f; }
  insert(values) { return new FilterBuilder(this._ctx, { method: 'POST', table: this._table, body: values, headers: { Prefer: 'return=representation' } }); }
  upsert(values) { return new FilterBuilder(this._ctx, { method: 'POST', table: this._table, body: values, headers: { Prefer: 'return=representation,resolution=merge-duplicates' } }); }
  update(values) { return new FilterBuilder(this._ctx, { method: 'PATCH', table: this._table, body: values, headers: { Prefer: 'return=representation' } }); }
  delete() { return new FilterBuilder(this._ctx, { method: 'DELETE', table: this._table, headers: { Prefer: 'return=representation' } }); }
}

module.exports = { QueryBuilder, FilterBuilder, addPrefer, countFromHeaders };
