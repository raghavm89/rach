'use strict';

/**
 * WhatsApp channel service (connectors Phase E).
 *
 * Two BSP shapes are supported for inbound parsing:
 *   - Meta WhatsApp Cloud API  (graph.facebook.com)
 *   - Gupshup                  (api.gupshup.io) — common for India
 * and the matching outbound send. WHATSAPP_MOCK=1 captures the outbound message
 * instead of calling the provider, so the whole webhook loop is testable without
 * a live BSP.
 *
 * Stored credentials (per tenant, encrypted) carry:
 *   { provider: 'meta'|'gupshup', api_key, phone_number_id, verify_token }
 */

const isMock = () => process.env.WHATSAPP_MOCK === '1' || process.env.WHATSAPP_MOCK === 'true';
const mockOutbox = []; // last outbound messages, for tests/inspection in mock mode

/** Extract the first inbound text message → { from, text }, or null (status/non-text). */
function parseInbound(body) {
  if (!body || typeof body !== 'object') return null;

  // Meta Cloud API
  const change = body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0];
  const msg = change && change.value && Array.isArray(change.value.messages) && change.value.messages[0];
  if (msg && msg.type === 'text' && msg.text && msg.text.body) {
    return { from: String(msg.from || ''), text: String(msg.text.body) };
  }

  // Gupshup
  if (body.type === 'message' && body.payload) {
    const p = body.payload;
    const text = p.payload && (p.payload.text || p.payload.title);
    const from = p.sender && (p.sender.phone || p.source);
    if ((p.type === 'text' || p.type === 'button_reply' || p.type === 'list_reply') && text && from) {
      return { from: String(from), text: String(text) };
    }
  }
  return null;
}

/** Send a text reply back through the tenant's provider. */
async function sendReply(creds = {}, { to, text }) {
  const provider = String(creds.provider || 'meta').toLowerCase();
  if (isMock()) { const m = { provider, to, text }; mockOutbox.push(m); return { mock: true, ...m }; }

  if (provider === 'gupshup') {
    const body = new URLSearchParams({
      channel: 'whatsapp', source: creds.phone_number_id || '', destination: to,
      'src.name': creds.app_name || '', message: JSON.stringify({ type: 'text', text }),
    });
    const res = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
      method: 'POST', headers: { apikey: creds.api_key, 'content-type': 'application/x-www-form-urlencoded' },
      body, signal: AbortSignal.timeout(8000),
    });
    return { status: res.status };
  }

  // Meta WhatsApp Cloud API (default)
  const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(creds.phone_number_id || '')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.api_key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    signal: AbortSignal.timeout(8000),
  });
  return { status: res.status };
}

module.exports = { parseInbound, sendReply, isMock, mockOutbox };
