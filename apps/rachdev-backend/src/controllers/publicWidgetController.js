'use strict';

/**
 * Public website-widget channel (connectors Phase C).
 *
 * Unauthenticated endpoints, keyed by a per-team public token minted on deploy.
 * A visitor on the tenant's website chats with their deployed team; runs are
 * metered against the OWNING tenant's credits (never the visitor). Because the
 * token ships in page HTML it is not a secret — these routes are additionally
 * rate-limited and credit-gated, and never expose the decision trace, tenant
 * id, or credit balance to the public.
 */

const { AgentTeam } = require('@rach/core');
const { credits } = require('@rach/billing');
const { runTeam } = require('../services/teamRuntime');

const UNAVAILABLE = "Sorry, the assistant is unavailable right now. Please try again later or reach out another way.";

// Resolve a deployed team from the token, or null (unknown / not live).
async function liveTeam(token) {
  const team = await AgentTeam.findByPublicToken(token);
  if (!team || team.status !== 'deployed') return null;
  return team;
}

// The website channel node can carry a title/greeting; otherwise sensible defaults.
function widgetConfig(team, graph) {
  const nodes = (graph && Array.isArray(graph.nodes)) ? graph.nodes : [];
  const channel = nodes.find((n) => n.type === 'channel' &&
    /web|site|widget/i.test(String((n.data && (n.data.channel || n.data.label)) || '')));
  const d = (channel && channel.data) || {};
  return {
    title: String(d.title || team.name || 'Assistant').slice(0, 60),
    greeting: String(d.greeting || 'Hi! How can I help you today?').slice(0, 240),
    accent: String(d.accent || '#4f46e5').slice(0, 16),
  };
}

// GET /api/public/widget/:token/config — render metadata for the embed.
exports.config = async (req, res) => {
  const team = await liveTeam(req.params.token);
  if (!team) return res.status(404).json({ error: 'Widget not found' });
  const graph = await AgentTeam.getPublishedGraph(team);
  res.json(widgetConfig(team, graph));
};

// POST /api/public/widget/:token/message — run the deployed team on a message.
exports.message = async (req, res) => {
  const team = await liveTeam(req.params.token);
  if (!team) return res.status(404).json({ error: 'Widget not found' });

  const message = String((req.body && req.body.message) || '').trim().slice(0, 4000);
  if (!message) return res.status(400).json({ error: 'Message required' });

  // Credit-gate quietly: a public visitor should never see billing state.
  const balance = await credits.getOrCreateBalance(team.tenant_id);
  if (balance <= 0) return res.json({ reply: UNAVAILABLE });

  const graph = await AgentTeam.getPublishedGraph(team);
  try {
    const out = await runTeam({ team: { ...team, graph }, message, tenantId: team.tenant_id, userId: null });
    res.json({ reply: out.reply }); // trace intentionally omitted from the public surface
  } catch (err) {
    if (err && err.code === 'insufficient_credits') return res.json({ reply: UNAVAILABLE });
    throw err;
  }
};

// GET /api/public/widget/:token/widget.js — the drop-in embed script. Renders a
// floating bubble + chat panel and talks to the two endpoints above. The tenant
// pastes one <script src=".../widget.js"> tag; the script derives its token and
// API base from its own src, so there is nothing else to configure.
// Build the embed script for a token (base is derived from the script's own src
// at runtime, so the same script serves both team-widget and single-agent bases).
function buildScript(token) {
  return WIDGET_JS.replace(/__TOKEN__/g, String(token || '').replace(/[^a-z0-9_]/gi, ''));
}

exports.buildScript = buildScript;
exports.script = async (req, res) => {
  res.type('application/javascript').set('Cache-Control', 'public, max-age=300');
  res.send(buildScript(req.params.token));
};

const WIDGET_JS = `(function(){
  var cur = document.currentScript;
  var base = cur ? cur.src.replace(/\\/widget\\.js.*$/, '') : '';
  var token = "__TOKEN__";
  var cfg = { title: 'Assistant', greeting: 'Hi! How can I help you today?', accent: '#4f46e5' };
  var open = false, booted = false;

  function el(tag, style, text){ var e=document.createElement(tag); if(style) e.setAttribute('style',style); if(text!=null) e.textContent=text; return e; }

  var bubble = el('button','position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);color:#fff;font-size:24px;z-index:2147483000;background:'+cfg.accent,'\\uD83D\\uDCAC');
  var panel = el('div','position:fixed;bottom:88px;right:20px;width:340px;max-width:calc(100vw - 40px);height:460px;max-height:calc(100vh - 120px);background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;z-index:2147483000;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
  var header = el('div','padding:14px 16px;color:#fff;font-weight:600;font-size:15px;background:'+cfg.accent, cfg.title);
  var log = el('div','flex:1;padding:12px;overflow-y:auto;background:#f7f7f8;font-size:14px;line-height:1.45');
  var form = el('form','display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff');
  var input = el('input','flex:1;padding:9px 11px;border:1px solid #ddd;border-radius:9px;font-size:14px;outline:none');
  input.setAttribute('placeholder','Type a message…');
  var send = el('button','padding:9px 14px;border:none;border-radius:9px;color:#fff;font-weight:600;cursor:pointer;background:'+cfg.accent,'Send');
  send.type='submit';
  form.appendChild(input); form.appendChild(send);
  panel.appendChild(header); panel.appendChild(log); panel.appendChild(form);
  document.body.appendChild(panel); document.body.appendChild(bubble);

  function paint(){ header.style.background=cfg.accent; bubble.style.background=cfg.accent; send.style.background=cfg.accent; header.textContent=cfg.title; }
  function row(who, text){
    var wrap = el('div','margin:6px 0;display:flex;'+(who==='you'?'justify-content:flex-end':'justify-content:flex-start'));
    var b = el('div', 'max-width:80%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;'+(who==='you'?'background:'+cfg.accent+';color:#fff':'background:#fff;color:#111;border:1px solid #eee'), text);
    wrap.appendChild(b); log.appendChild(wrap); log.scrollTop=log.scrollHeight; return b;
  }
  function boot(){
    if(booted) return; booted=true;
    fetch(base+'/config').then(function(r){return r.json();}).then(function(c){ if(c&&c.title){cfg=c; paint();} row('bot', cfg.greeting); }).catch(function(){ row('bot', cfg.greeting); });
  }
  bubble.onclick=function(){ open=!open; panel.style.display=open?'flex':'none'; if(open){ boot(); input.focus(); } };
  form.onsubmit=function(ev){
    ev.preventDefault();
    var msg=(input.value||'').trim(); if(!msg) return; input.value='';
    row('you', msg);
    var typing=row('bot','…');
    fetch(base+'/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})})
      .then(function(r){return r.json();})
      .then(function(d){ typing.textContent=(d&&d.reply)||'Sorry, something went wrong.'; log.scrollTop=log.scrollHeight; })
      .catch(function(){ typing.textContent='Sorry, something went wrong.'; });
  };
})();`;
