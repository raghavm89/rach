'use strict';

/**
 * Transactional email via Brevo (formerly Sendinblue). A single platform Brevo key sends every
 * project's auth emails (confirmation, magic link, reset). PURE-ish: the HTTP client is injected
 * so the sender is unit-tested without network. Returns a `send` fn, or null when unconfigured
 * (callers then no-op and — in dev — surface the token in the API response instead).
 *
 * Env (platform): BAAS_BREVO_API_KEY, BAAS_BREVO_SENDER ("Name <no-reply@domain>" or an email).
 */

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function parseSender(sender) {
  const s = String(sender || '').trim();
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s);
  if (m) return { name: m[1] || 'Auth', email: m[2] };
  return { name: 'Auth', email: s };
}

function makeBrevoMailer({ apiKey, sender, fetchImpl = fetch } = {}) {
  if (!apiKey || !sender) return null;
  const from = parseSender(sender);
  return async function send({ to, subject, htmlContent, textContent }) {
    if (!to) throw new Error('mailer: `to` required');
    const resp = await fetchImpl(BREVO_ENDPOINT, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: from,
        to: [{ email: to }],
        subject,
        ...(htmlContent ? { htmlContent } : {}),
        ...(textContent ? { textContent } : {}),
      }),
    });
    if (!resp.ok) {
      let detail = ''; try { detail = JSON.stringify(await resp.json()); } catch { /* ignore */ }
      throw new Error(`brevo_send_failed_${resp.status}${detail ? ` ${detail}` : ''}`);
    }
    return { sent: true };
  };
}

// The confirmation email body. `link` is the clickable verify URL (GET), `token` the raw token.
function confirmationEmail({ link }) {
  return {
    subject: 'Confirm your email',
    htmlContent: `<p>Welcome! Please confirm your email to finish signing up.</p>
<p><a href="${link}">Confirm email</a></p>
<p>If the button doesn't work, paste this link into your browser:<br>${link}</p>`,
    textContent: `Confirm your email: ${link}`,
  };
}

module.exports = { makeBrevoMailer, confirmationEmail, parseSender, BREVO_ENDPOINT };
