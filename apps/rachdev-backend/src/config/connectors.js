'use strict';

/**
 * Connector registry — the catalogue of integrations the Connections page shows
 * and the tool runtime dispatches to. `auth` decides how a tenant connects:
 *   - 'api_key' → a form of the listed `fields` (secret fields are encrypted)
 *   - 'oauth'   → an authorize button → provider consent (see oauthProviders.js)
 *   - 'none'    → built-in / platform-provided; nothing to configure
 * `category`: 'channel' (inbound) or 'tool' (outbound action/data).
 * Action handlers themselves are implemented per phase; this manifest is the
 * single source of truth for what exists.
 */

const CONNECTORS = [
  // ── Tools ──────────────────────────────────────────────────────────────────
  {
    id: 'razorpay', name: 'Razorpay', category: 'tool', auth: 'api_key',
    blurb: 'Look up payments and issue refunds (India).',
    fields: [
      { key: 'key_id', label: 'Key ID' },
      { key: 'key_secret', label: 'Key Secret', secret: true },
    ],
    actions: ['lookup_payment', 'refund'],
  },
  {
    id: 'stripe', name: 'Stripe', category: 'tool', auth: 'api_key',
    blurb: 'Look up charges and issue refunds.',
    fields: [{ key: 'secret_key', label: 'Secret Key (sk_…)', secret: true }],
    actions: ['lookup_charge', 'refund'],
  },
  {
    id: 'shopify', name: 'Shopify', category: 'tool', auth: 'oauth',
    blurb: 'Look up orders and fulfilment status.',
    fields: [{ key: 'shop', label: 'Shop domain (my-store.myshopify.com)' }],
    actions: ['lookup_order'],
  },
  {
    id: 'perplexity', name: 'Perplexity', category: 'tool', auth: 'api_key',
    blurb: 'Live web search & cited answers (uses your Perplexity key).',
    fields: [{ key: 'api_key', label: 'API Key (pplx-…)', secret: true }],
    actions: ['web_search'],
  },
  {
    id: 'email', name: 'Email', category: 'tool', auth: 'none',
    blurb: 'Send transactional email (via the platform provider).',
    actions: ['send_email'],
  },
  {
    id: 'knowledge_base', name: 'Knowledge Base', category: 'tool', auth: 'none',
    blurb: 'Answer from your uploaded docs and FAQs.',
    actions: ['search'],
  },
  {
    id: 'http', name: 'HTTP Action', category: 'tool', auth: 'none',
    blurb: 'Call any allowlisted HTTPS endpoint (configured per node).',
    actions: ['request'],
  },
  // ── Models (bring your own key) ──────────────────────────────────────────────
  // When connected, this tenant's agent + team runs use their own key and are
  // NOT billed in credits (the platform key + credits are the default).
  {
    id: 'anthropic', name: 'Anthropic (your key)', category: 'model', auth: 'api_key',
    blurb: 'Run your agents on your own Anthropic key — usage billed by Anthropic, not credits.',
    fields: [{ key: 'api_key', label: 'Anthropic API key (sk-ant-…)', secret: true }],
    actions: [],
  },
  {
    id: 'openai', name: 'OpenAI (your key)', category: 'model', auth: 'api_key',
    blurb: 'Run your agents on your own OpenAI key (GPT-4o) — usage billed by OpenAI, not credits.',
    fields: [
      { key: 'api_key', label: 'OpenAI API key (sk-…)', secret: true },
      { key: 'model', label: 'Model (default gpt-4o-mini)' },
    ],
    actions: [],
  },

  // ── Channels ────────────────────────────────────────────────────────────────
  {
    id: 'website_widget', name: 'Website Widget', category: 'channel', auth: 'none',
    blurb: 'Embed a chat widget on your site.',
    actions: [],
  },
  {
    id: 'slack', name: 'Slack', category: 'channel', auth: 'oauth',
    blurb: 'Receive messages and post replies in Slack.',
    actions: ['post_message'],
  },
  {
    id: 'whatsapp', name: 'WhatsApp', category: 'channel', auth: 'api_key',
    blurb: 'Chat with customers on WhatsApp (via a Business API provider).',
    fields: [
      { key: 'provider', label: 'Provider (meta / gupshup)' },
      { key: 'api_key', label: 'API Key / Access Token', secret: true },
      { key: 'phone_number_id', label: 'Phone number ID (sender)' },
      { key: 'verify_token', label: 'Webhook verify token (you choose)' },
    ],
    actions: ['send_message'],
  },
];

const byId = (id) => CONNECTORS.find((c) => c.id === id) || null;

// Public view — never leak field `secret` values (there are none here, but keep
// the manifest shape stable for the client).
function publicList() {
  return CONNECTORS.map((c) => ({
    id: c.id, name: c.name, category: c.category, auth: c.auth, blurb: c.blurb,
    fields: (c.fields || []).map((f) => ({ key: f.key, label: f.label, secret: !!f.secret })),
    actions: c.actions || [],
  }));
}

module.exports = { CONNECTORS, byId, publicList };
