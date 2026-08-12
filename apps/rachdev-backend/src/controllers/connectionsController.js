'use strict';

/**
 * Connections controller — the connector framework (Phase A).
 * Lists the catalogue merged with the tenant's connection status, and connects/
 * disconnects a connector. Credentials are encrypted by the Integration model;
 * they are never returned to the client. (Named "connections" to avoid the
 * healthcare integrationsController — ECHS/ABHA.)
 */

const { Integration } = require('@rach/core');
const connectors = require('../config/connectors');
const oauth = require('../config/oauthProviders');

// Where the provider redirects back to (must match the app's registered URI).
const redirectBase = (req) => process.env.PUBLIC_API_BASE || `${req.protocol}://${req.get('host')}`;
const callbackUri = (req) => `${redirectBase(req)}/api/integrations/oauth/callback`;

// Only allow post-callback redirects back to known dashboards (no open redirect).
function allowedReturn(url) {
  if (!url) return null;
  const list = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (process.env.DASHBOARD_URL) list.push(process.env.DASHBOARD_URL);
  try {
    const u = new URL(url);
    const origin = `${u.protocol}//${u.host}`;
    return (list.includes('*') || list.includes(origin) || list.includes(url)) ? origin : null;
  } catch { return null; }
}
const fallbackReturn = () => process.env.DASHBOARD_URL || null;

const noWorkspace = (req, res) => {
  if (req.user.tenant_id == null) { res.status(400).json({ error: 'No workspace provisioned for this account yet', code: 'no_tenant' }); return true; }
  return false;
};

// GET /api/integrations — catalogue + this tenant's connection status.
exports.list = async (req, res) => {
  const catalogue = connectors.publicList();
  if (req.user.tenant_id == null) return res.json({ connectors: catalogue.map((c) => ({ ...c, connected: false, config: {} })) });
  const connections = await Integration.list(req.user.tenant_id);
  const byConn = new Map(connections.map((r) => [r.connector, r]));
  res.json({
    connectors: catalogue.map((c) => {
      const row = byConn.get(c.id);
      return { ...c, connected: row ? row.status === 'connected' : false, config: row ? row.config : {} };
    }),
  });
};

// POST /api/integrations/:id/connect — store credentials/config for a connector.
exports.connect = async (req, res) => {
  if (noWorkspace(req, res)) return;
  const c = connectors.byId(req.params.id);
  if (!c) return res.status(404).json({ error: 'Unknown connector' });

  const { credentials = {}, config = {} } = req.body || {};
  if (c.auth === 'api_key') {
    const missing = (c.fields || []).filter((f) => !credentials || !String(credentials[f.key] || '').trim());
    if (missing.length) return res.status(400).json({ error: `Missing: ${missing.map((f) => f.label).join(', ')}` });
  }
  const connection = await Integration.connect(req.user.tenant_id, c.id, { credentials, config, userId: req.user.id });
  res.status(201).json({ connection });
};

// ── OAuth connectors (Slack, Shopify) ────────────────────────────────────────

// GET /api/integrations/:id/oauth/start — return the provider authorize URL.
// State carries tenant/connector/user + return origin across the redirect.
exports.oauthStart = async (req, res) => {
  if (noWorkspace(req, res)) return;
  const provider = oauth.byId(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Unknown OAuth connector' });
  if (!oauth.isConfigured(provider)) return res.status(400).json({ error: `${req.params.id} OAuth is not configured on this server` });

  let shop;
  if (provider.connector === 'shopify') {
    shop = String(req.query.shop || '').trim().toLowerCase();
    if (!provider.validShop(shop)) return res.status(400).json({ error: 'A valid *.myshopify.com shop domain is required' });
  }

  const returnTo = allowedReturn(req.query.return || req.headers.origin) || fallbackReturn();
  const state = oauth.signState({ tid: req.user.tenant_id, conn: provider.connector, uid: req.user.id, shop, returnTo });
  const url = provider.authorizeUrl({ state, redirectUri: callbackUri(req), shop });
  res.json({ url });
};

// GET /api/integrations/oauth/callback — provider redirects the browser here.
// Unauthenticated: trust comes from the signed state, not a session.
exports.oauthCallback = async (req, res) => {
  const data = oauth.verifyState(req.query.state);
  const back = (data && allowedReturn(data.returnTo)) || fallbackReturn();
  const done = (qs) => back
    ? res.redirect(`${back}/dashboard/connections?${qs}`)
    : res.type('html').send(`<p>${qs.includes('error') ? 'Connection failed.' : 'Connected — you can close this tab.'}</p>`);

  if (req.query.error) return done(`error=${encodeURIComponent(String(req.query.error))}`);
  if (!data) return res.status(400).type('html').send('<p>This authorization link is invalid or has expired. Please try again.</p>');

  const provider = oauth.byId(data.conn);
  if (!provider) return done('error=unknown_connector');
  // Shopify echoes the shop back — it must match what we started with.
  if (provider.connector === 'shopify' && String(req.query.shop || '').toLowerCase() !== data.shop) return done('error=shop_mismatch');

  try {
    const { credentials, config } = await provider.exchange({ code: String(req.query.code || ''), redirectUri: callbackUri(req), shop: data.shop });
    await Integration.connect(data.tid, provider.connector, { credentials, config, userId: data.uid });
    return done(`connected=${provider.connector}`);
  } catch (err) {
    if (process.env.OAUTH_DEBUG) console.error('[oauth callback]', err);
    return done(`error=${encodeURIComponent(provider.connector)}`);
  }
};

// POST /api/integrations/:id/disconnect
exports.disconnect = async (req, res) => {
  if (noWorkspace(req, res)) return;
  const c = connectors.byId(req.params.id);
  if (!c) return res.status(404).json({ error: 'Unknown connector' });
  await Integration.disconnect(req.user.tenant_id, c.id);
  res.json({ ok: true });
};
