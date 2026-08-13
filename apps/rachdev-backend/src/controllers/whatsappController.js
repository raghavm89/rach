'use strict';

/**
 * WhatsApp channel webhook (connectors Phase E).
 *
 * Per-team endpoint keyed by the team's public token (same token minted on
 * deploy for the website widget). A BSP (Meta Cloud API / Gupshup) is pointed at
 * this URL for the tenant's business number. Inbound texts run the deployed team
 * (metered against the owning tenant) and the reply is sent back through the
 * tenant's stored WhatsApp credentials.
 *
 * GET  = Meta subscription handshake (echo hub.challenge if verify_token matches).
 * POST = inbound message → run team → reply. Always answers 200 quickly so the
 *        BSP does not retry; unparseable/non-text events are ignored.
 */

const { AgentTeam, Integration } = require('@rach/core');
const { credits } = require('@rach/billing');
const { runTeam } = require('../services/teamRuntime');
const wa = require('../services/whatsapp');

async function liveTeamCreds(token) {
  const team = await AgentTeam.findByPublicToken(token);
  if (!team || team.status !== 'deployed') return null;
  const conn = await Integration.getCredentials(team.tenant_id, 'whatsapp');
  return { team, creds: conn ? conn.credentials : null };
}

// GET — Meta verification handshake.
exports.verify = async (req, res) => {
  const ctx = await liveTeamCreds(req.params.token);
  const challenge = req.query['hub.challenge'];
  const verifyToken = req.query['hub.verify_token'];
  if (ctx && ctx.creds && verifyToken && verifyToken === ctx.creds.verify_token) {
    return res.status(200).send(String(challenge ?? ''));
  }
  return res.sendStatus(403);
};

// POST — inbound message.
exports.inbound = async (req, res) => {
  const ctx = await liveTeamCreds(req.params.token);
  if (!ctx) return res.sendStatus(404);
  // Ack immediately-parseable non-messages (status callbacks, non-text) so BSPs stop.
  const parsed = wa.parseInbound(req.body);
  if (!parsed || !ctx.creds) return res.json({ ignored: true });

  // Meter against the owning tenant; skip silently (no spend, no reply) if empty.
  const balance = await credits.getOrCreateBalance(ctx.team.tenant_id);
  if (balance <= 0) return res.json({ ignored: true, reason: 'no_credits' });

  const graph = await AgentTeam.getPublishedGraph(ctx.team);
  try {
    const out = await runTeam({ team: { ...ctx.team, graph }, message: parsed.text, tenantId: ctx.team.tenant_id, userId: null, log: { channel: 'whatsapp', conversationId: parsed.from || null } });
    await wa.sendReply(ctx.creds, { to: parsed.from, text: out.reply });
    return res.json({ ok: true });
  } catch (err) {
    if (err && err.code === 'insufficient_credits') return res.json({ ignored: true, reason: 'no_credits' });
    if (process.env.WHATSAPP_DEBUG) console.error('[whatsapp inbound]', err);
    return res.json({ ok: false }); // still 200 so the BSP doesn't hammer retries
  }
};
