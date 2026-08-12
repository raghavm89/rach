'use strict';

/**
 * OAuth provider config for connector authorization (connectors Phase D).
 *
 * Each provider knows how to build an authorize URL and exchange a code for a
 * token. Client id/secret come from env; a provider is "configured" only when
 * both are present. The `state` parameter is a signed, short-lived token that
 * carries the tenant + connector across the redirect (CSRF-safe, no server-side
 * session needed) — see signState/verifyState.
 *
 * OAUTH_MOCK=1 short-circuits the token exchange with a fake token so the whole
 * flow is exercisable in dev/CI without real provider apps.
 */

const crypto = require('crypto');

const isMock = () => process.env.OAUTH_MOCK === '1' || process.env.OAUTH_MOCK === 'true';
const secret = () => process.env.INTEGRATIONS_ENCRYPTION_KEY || 'dev-oauth-secret';
const b64u = (buf) => Buffer.from(buf).toString('base64url');

// ── Signed state (HMAC over a base64url JSON payload; 10-minute TTL) ──────────
function signState(payload) {
  const body = b64u(JSON.stringify({ ...payload, exp: Date.now() + 10 * 60 * 1000, nonce: crypto.randomBytes(8).toString('hex') }));
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyState(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let data; try { data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  return data;
}

const PROVIDERS = {
  slack: {
    connector: 'slack',
    scopes: (process.env.SLACK_SCOPES || 'chat:write,channels:read').split(',').map((s) => s.trim()).filter(Boolean),
    clientId: () => process.env.SLACK_CLIENT_ID,
    clientSecret: () => process.env.SLACK_CLIENT_SECRET,
    authorizeUrl({ state, redirectUri }) {
      const p = new URLSearchParams({
        client_id: this.clientId(), scope: this.scopes.join(','),
        redirect_uri: redirectUri, state,
      });
      return `https://slack.com/oauth/v2/authorize?${p.toString()}`;
    },
    async exchange({ code, redirectUri }) {
      if (isMock()) return { credentials: { access_token: 'xoxb-mock' }, config: { team: 'Mock Workspace', team_id: 'T_MOCK' } };
      const body = new URLSearchParams({
        client_id: this.clientId(), client_secret: this.clientSecret(),
        code, redirect_uri: redirectUri,
      });
      const res = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(10000),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'slack oauth failed');
      const access = j.access_token || (j.bot && j.bot.bot_access_token);
      return { credentials: { access_token: access }, config: { team: j.team && j.team.name, team_id: j.team && j.team.id } };
    },
  },

  shopify: {
    connector: 'shopify',
    scopes: (process.env.SHOPIFY_SCOPES || 'read_orders,read_fulfillments').split(',').map((s) => s.trim()).filter(Boolean),
    clientId: () => process.env.SHOPIFY_CLIENT_ID,
    clientSecret: () => process.env.SHOPIFY_CLIENT_SECRET,
    // Shopify authorizes on the shop's own domain, so `shop` is required.
    validShop(shop) { return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(String(shop || '')); },
    authorizeUrl({ state, redirectUri, shop }) {
      const p = new URLSearchParams({
        client_id: this.clientId(), scope: this.scopes.join(','),
        redirect_uri: redirectUri, state,
      });
      return `https://${shop}/admin/oauth/authorize?${p.toString()}`;
    },
    async exchange({ code, shop }) {
      if (isMock()) return { credentials: { access_token: 'shpat_mock' }, config: { shop } };
      const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: this.clientId(), client_secret: this.clientSecret(), code }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`shopify oauth failed (${res.status})`);
      const j = await res.json();
      if (!j.access_token) throw new Error('shopify returned no access_token');
      return { credentials: { access_token: j.access_token }, config: { shop } };
    },
  },
};

const byId = (id) => PROVIDERS[String(id || '').toLowerCase()] || null;
const isConfigured = (p) => isMock() || !!(p && p.clientId() && p.clientSecret());

module.exports = { PROVIDERS, byId, isConfigured, isMock, signState, verifyState };
