'use strict';

/**
 * Auth client — supabase-js-shaped, over `<url>/auth/v1`. Holds the current session, persists it
 * (injectable storage; localStorage in the browser), and provides the access token every other
 * client uses for `Authorization`. Methods return `{ data, error }` (no throw).
 */

const SESSION_KEY = 'rachbase.session';

class AuthClient {
  constructor({ url, key, fetch, storage }) {
    this._url = url;
    this._key = key;
    this._fetch = fetch;
    this._storage = storage || null;
    this._session = null;
    this._listeners = new Set();
    if (this._storage) {
      try { const raw = this._storage.getItem(SESSION_KEY); if (raw) this._session = JSON.parse(raw); } catch { /* ignore */ }
    }
  }

  currentAccessToken() { return (this._session && this._session.access_token) || this._key; }

  async _req(path, { method = 'GET', body, token } = {}) {
    const headers = { apikey: this._key, 'Content-Type': 'application/json', Authorization: `Bearer ${token || this.currentAccessToken()}` };
    let res;
    try { res = await this._fetch(`${this._url}${path}`, { method, headers, body: body != null ? JSON.stringify(body) : undefined }); }
    catch (e) { return { ok: false, status: 0, body: { message: e.message } }; }
    const text = await res.text();
    let b = null; try { b = text ? JSON.parse(text) : null; } catch { b = text; }
    return { ok: res.ok, status: res.status, body: b };
  }

  _setSession(session) {
    this._session = session || null;
    if (this._storage) { try { session ? this._storage.setItem(SESSION_KEY, JSON.stringify(session)) : this._storage.removeItem(SESSION_KEY); } catch { /* ignore */ } }
    const event = session ? 'SIGNED_IN' : 'SIGNED_OUT';
    for (const cb of this._listeners) { try { cb(event, session); } catch { /* listener error */ } }
  }

  // A body carrying an access_token IS the session (Supabase shape).
  _fromResponse(r) {
    if (!r.ok) return { data: { user: null, session: null }, error: { message: (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`, status: r.status } };
    const session = r.body && r.body.access_token ? r.body : null;
    if (session) this._setSession(session);
    return { data: { user: (r.body && r.body.user) || null, session }, error: null };
  }

  async signUp({ email, password }) { return this._fromResponse(await this._req('/signup', { method: 'POST', body: { email, password } })); }
  async signInWithPassword({ email, password }) { return this._fromResponse(await this._req('/token?grant_type=password', { method: 'POST', body: { email, password } })); }
  async signInAnonymously() { return this._fromResponse(await this._req('/signup/anonymous', { method: 'POST', body: {} })); }
  async verifyOtp({ email, token, type = 'email' }) { return this._fromResponse(await this._req('/verify', { method: 'POST', body: { email, token, type } })); }

  async refreshSession() {
    const rt = this._session && this._session.refresh_token;
    if (!rt) return { data: { session: null }, error: { message: 'no refresh token', status: 400 } };
    return this._fromResponse(await this._req('/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: rt } }));
  }

  async getUser(token) {
    const r = await this._req('/user', { method: 'GET', token });
    if (!r.ok) return { data: { user: null }, error: { message: (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`, status: r.status } };
    return { data: { user: r.body && (r.body.user || r.body) }, error: null };
  }

  async signOut() {
    try { await this._req('/logout', { method: 'POST', body: {} }); } catch { /* best-effort */ }
    this._setSession(null);
    return { error: null };
  }

  // ── Data-principal rights (DPDP) ───────────────────────────────────────────
  async updateUser({ email } = {}) { // right to correction
    const r = await this._req('/user', { method: 'PATCH', body: { email } });
    if (!r.ok) return { data: { user: null }, error: { message: (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`, status: r.status } };
    return { data: { user: r.body }, error: null };
  }
  async exportData() { // right to access — the personal data Auth holds about you
    const r = await this._req('/user/export', { method: 'GET' });
    if (!r.ok) return { data: null, error: { message: (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`, status: r.status } };
    return { data: r.body, error: null };
  }
  async deleteUser() { // right to erasure — deletes your own account, then clears the session
    const r = await this._req('/user', { method: 'DELETE' });
    if (!r.ok) return { data: null, error: { message: (r.body && (r.body.message || r.body.error)) || `HTTP ${r.status}`, status: r.status } };
    this._setSession(null);
    return { data: r.body, error: null };
  }

  getSession() { return { data: { session: this._session }, error: null }; }
  setSession(session) { this._setSession(session); return { data: { session }, error: null }; }
  onAuthStateChange(cb) {
    this._listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => this._listeners.delete(cb) } } };
  }
}

module.exports = { AuthClient, SESSION_KEY };
