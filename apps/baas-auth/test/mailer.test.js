'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeBrevoMailer, confirmationEmail, parseSender, BREVO_ENDPOINT } = require('../src/mailer');

test('unconfigured mailer is null (callers no-op)', () => {
  assert.equal(makeBrevoMailer({}), null);
  assert.equal(makeBrevoMailer({ apiKey: 'x' }), null);      // sender required too
});

test('parseSender handles "Name <email>" and bare email', () => {
  assert.deepEqual(parseSender('Rachbase <no-reply@rachbase.app>'), { name: 'Rachbase', email: 'no-reply@rachbase.app' });
  assert.deepEqual(parseSender('hi@x.com'), { name: 'Auth', email: 'hi@x.com' });
});

test('send posts to Brevo with the api-key header and shaped payload', async () => {
  let captured = null;
  const fetchImpl = async (url, opts) => { captured = { url, opts }; return { ok: true, json: async () => ({ messageId: '1' }) }; };
  const send = makeBrevoMailer({ apiKey: 'secret-key', sender: 'Rachbase <no-reply@rachbase.app>', fetchImpl });

  const r = await send({ to: 'user@example.com', ...confirmationEmail({ link: 'https://p1.rachbase.app/auth/v1/verify?token=abc' }) });
  assert.deepEqual(r, { sent: true });
  assert.equal(captured.url, BREVO_ENDPOINT);
  assert.equal(captured.opts.headers['api-key'], 'secret-key');
  const body = JSON.parse(captured.opts.body);
  assert.deepEqual(body.sender, { name: 'Rachbase', email: 'no-reply@rachbase.app' });
  assert.equal(body.to[0].email, 'user@example.com');
  assert.match(body.subject, /confirm/i);
  assert.match(body.htmlContent, /verify\?token=abc/);
});

test('send throws with status on a Brevo error', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ message: 'bad key' }) });
  const send = makeBrevoMailer({ apiKey: 'nope', sender: 'a@b.com', fetchImpl });
  await assert.rejects(() => send({ to: 'x@y.com', subject: 's', htmlContent: 'h' }), /brevo_send_failed_401/);
});
