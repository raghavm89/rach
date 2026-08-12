'use strict';

/**
 * Agent tool registry. Turns a specialist's connected integration nodes into
 * model tool definitions + executable handlers.
 *
 * Real vs simulated:
 *   - In LLM_MOCK (demo) mode, every tool returns simulated data (no external
 *     calls, no spend).
 *   - In real mode, connectors with a real handler AND a connected credential
 *     (Connections page) make live calls; otherwise they fall back to simulated
 *     so a half-configured team still responds.
 *
 * Real today: Razorpay, Stripe (lookup/refund), Email (Brevo), Slack (post),
 * Shopify (order lookup), Knowledge base (full-text over the tenant's docs),
 * HTTP action.
 * Simulated: any connector without a real handler yet.
 */

const { Integration, KnowledgeBase, brevo } = require('@rach/core');

const isMock = () => process.env.LLM_MOCK === '1' || process.env.LLM_MOCK === 'true';

function toolNameFor(node) {
  const base = String((node.data && node.data.integration) || 'tool')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'tool';
  const suffix = String(node.id || '').replace(/[^a-z0-9]/gi, '').slice(-4) || '0';
  return `${base}_${suffix}`;
}

function connectorIdFor(node) {
  const explicit = node.data && node.data.connectorId;
  if (explicit) return String(explicit).toLowerCase();
  const n = String((node.data && node.data.integration) || '').toLowerCase();
  for (const id of ['razorpay', 'stripe', 'shopify', 'slack', 'whatsapp', 'email', 'perplexity']) if (n.includes(id)) return id;
  if (n.includes('mail')) return 'email';
  return n.replace(/[^a-z0-9]/g, '') || 'service';
}

// SSRF guard: only public https endpoints; block localhost + private ranges.
function assertSafeUrl(raw) {
  let u; try { u = new URL(raw); } catch { throw new Error('invalid url'); }
  if (u.protocol !== 'https:') throw new Error('only https:// endpoints are allowed');
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc00:|fe80:)/i.test(u.hostname)) throw new Error('endpoint host is not allowed');
  return u;
}
async function httpAction(cfg, input) {
  assertSafeUrl(cfg.url);
  const method = (cfg.method || 'GET').toUpperCase();
  const res = await fetch(cfg.url, {
    method, headers: { accept: 'application/json', 'content-type': 'application/json' },
    ...(method !== 'GET' && input ? { body: JSON.stringify(input) } : {}), signal: AbortSignal.timeout(8000),
  });
  return { status: res.status, body: (await res.text()).slice(0, 2000) };
}

function simulatedConnector(name, input = {}) {
  const n = String(name).toLowerCase();
  if (n.includes('razorpay') || n.includes('stripe')) return { simulated: true, action: input.action || 'lookup', id: input.payment_id || input.charge_id || 'pay_sim_1', status: input.action === 'refund' ? 'refunded' : 'captured', amount: input.amount || 0 };
  if (n.includes('shopify')) return { simulated: true, order_id: input.order_id || 'NK-4821', status: 'in_transit', carrier: 'Delhivery', eta_days: 2 };
  if (n.includes('slack')) return { simulated: true, posted: true, channel: input.channel || '#support' };
  if (n.includes('email') || n.includes('mail')) return { simulated: true, sent: true, to: input.to || 'user@example.com' };
  return { simulated: true, echo: input };
}

// ── Real connector handlers (used only in real mode with connected creds) ──────
const REAL = {
  razorpay: {
    description: 'Look up a Razorpay payment or issue a refund.',
    input_schema: { type: 'object', properties: { action: { type: 'string', enum: ['lookup', 'refund'] }, payment_id: { type: 'string' }, amount_inr: { type: 'number' } }, required: ['action', 'payment_id'] },
    async run(creds, input) {
      const auth = 'Basic ' + Buffer.from(`${creds.key_id}:${creds.key_secret}`).toString('base64');
      if (input.action === 'refund') {
        const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.payment_id)}/refund`, { method: 'POST', headers: { Authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(input.amount_inr ? { amount: Math.round(input.amount_inr * 100) } : {}), signal: AbortSignal.timeout(8000) });
        return { status: res.status, body: (await res.text()).slice(0, 1500) };
      }
      const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.payment_id)}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) });
      return { status: res.status, body: (await res.text()).slice(0, 1500) };
    },
  },
  stripe: {
    description: 'Look up a Stripe charge or issue a refund.',
    input_schema: { type: 'object', properties: { action: { type: 'string', enum: ['lookup', 'refund'] }, charge_id: { type: 'string' }, amount: { type: 'number' } }, required: ['action', 'charge_id'] },
    async run(creds, input) {
      const auth = 'Bearer ' + creds.secret_key;
      if (input.action === 'refund') {
        const body = new URLSearchParams({ charge: input.charge_id, ...(input.amount ? { amount: String(Math.round(input.amount * 100)) } : {}) });
        const res = await fetch('https://api.stripe.com/v1/refunds', { method: 'POST', headers: { Authorization: auth, 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(8000) });
        return { status: res.status, body: (await res.text()).slice(0, 1500) };
      }
      const res = await fetch(`https://api.stripe.com/v1/charges/${encodeURIComponent(input.charge_id)}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) });
      return { status: res.status, body: (await res.text()).slice(0, 1500) };
    },
  },
  email: {
    description: 'Send a transactional email to a recipient.',
    input_schema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] },
    async run(_creds, input) {
      await brevo.sendEmail({ to: input.to, subject: input.subject, htmlContent: `<p>${String(input.body).replace(/\n/g, '<br>')}</p>`, textContent: input.body });
      return { sent: true, to: input.to };
    },
  },
  slack: {
    description: 'Post a message to a Slack channel.',
    input_schema: { type: 'object', properties: { channel: { type: 'string', description: 'Channel id or #name' }, text: { type: 'string' } }, required: ['channel', 'text'] },
    async run(creds, input) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.access_token}`, 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ channel: input.channel, text: input.text }), signal: AbortSignal.timeout(8000),
      });
      const j = await res.json();
      if (!j.ok) return { error: j.error || 'slack error' };
      return { posted: true, channel: input.channel, ts: j.ts };
    },
  },
  perplexity: {
    description: 'Search the live web and return a cited answer (use for current/real-time info).',
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    async run(creds, input) {
      const res = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${creds.api_key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: creds.model || 'sonar', messages: [{ role: 'user', content: String(input.query || '') }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { error: `perplexity error (${res.status})` };
      const j = await res.json();
      const answer = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      return { answer: answer || '', citations: j.citations || [] };
    },
  },
  shopify: {
    description: 'Look up a Shopify order by name/number and its fulfilment status.',
    input_schema: { type: 'object', properties: { order_name: { type: 'string', description: 'Order name, e.g. #1001' } }, required: ['order_name'] },
    async run(creds, input, config = {}) {
      const shop = config.shop;
      if (!shop) return { error: 'shop not configured' };
      const q = new URLSearchParams({ status: 'any', name: String(input.order_name || '') });
      const res = await fetch(`https://${shop}/admin/api/2024-01/orders.json?${q.toString()}`, {
        headers: { 'X-Shopify-Access-Token': creds.access_token, accept: 'application/json' }, signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { error: `shopify error (${res.status})` };
      const j = await res.json();
      const o = (j.orders || [])[0];
      if (!o) return { found: false, order_name: input.order_name };
      return { found: true, order_name: o.name, financial_status: o.financial_status, fulfillment_status: o.fulfillment_status, total: o.total_price };
    },
  },
};

/** Build { tools, handlers } from integration nodes. tenantId resolves creds. */
function buildTools(integrationNodes = [], { tenantId } = {}) {
  const tools = [];
  const handlers = {};
  for (const node of integrationNodes) {
    const d = (node && node.data) || {};
    const kind = d.toolType || 'connector';
    const name = toolNameFor(node);
    const svc = d.integration || 'the service';

    if (kind === 'http') {
      tools.push({ name, description: `Call the ${svc} endpoint.`, input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Params/query' } } } });
      handlers[name] = (input) => httpAction(d, input);
      continue;
    }
    if (kind === 'knowledge') {
      tools.push({ name, description: `Search the ${svc} knowledge base for relevant passages. Answer using ONLY the returned passages and cite their titles; if nothing relevant is returned, say you don't have that information.`, input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } });
      handlers[name] = async (input) => {
        if (tenantId == null) return { results: [] };
        const hits = await KnowledgeBase.search(tenantId, input.query, 4);
        return {
          query: input.query,
          results: hits.map((h) => ({ title: h.title, citation: h.citation || null, text: h.text })),
        };
      };
      continue;
    }

    const cid = connectorIdFor(node);
    const real = REAL[cid];
    tools.push({
      name,
      description: real ? real.description : `Use ${svc} to look up data or perform an action.`,
      input_schema: real ? real.input_schema : { type: 'object', properties: { order_id: { type: 'string' }, amount: { type: 'number' }, channel: { type: 'string' }, query: { type: 'string' } } },
    });
    handlers[name] = async (input) => {
      if (isMock()) return simulatedConnector(svc, input);          // demo: never call out
      if (real) {
        try {
          if (cid === 'email') return await real.run(null, input);  // platform provider
          const conn = tenantId != null ? await Integration.getCredentials(tenantId, cid) : null;
          if (conn) return await real.run(conn.credentials, input, conn.config); // connected → live
        } catch (e) { return { error: String(e.message) }; }
      }
      return simulatedConnector(svc, input);                        // not connected → demo
    };
  }
  return { tools, handlers };
}

module.exports = { buildTools, toolNameFor };
