'use strict';

/**
 * RachDev Runtime Agent — the on-prem / BYOC data plane.
 *
 * A tiny, dependency-free daemon the customer runs inside their own network or
 * cloud. It:
 *   1. PULLS its AgentSpec from the RachDev control plane (outbound only),
 *   2. RUNS the agent locally against the customer's OWN LLM key,
 *   3. PUSHES metadata-only telemetry back (counts, latency, version) — never
 *      conversation content.
 *
 * The control plane never connects inbound; the agent phones home. Raw messages
 * and replies stay on the customer's infrastructure.
 *
 * Config (env):
 *   RACHDEV_CONTROL_URL    e.g. https://api.rachdev.com   (required)
 *   RACHDEV_RUNTIME_TOKEN  rt_…  minted at deploy         (required)
 *   LLM_PROVIDER           anthropic | openai             (default anthropic)
 *   LLM_API_KEY            the customer's model key        (required)
 *   LLM_MODEL              override the spec's model        (optional)
 *   PORT                   local HTTP port                 (default 8080)
 */

const http = require('http');

const VERSION = '1.0.0';
const CONTROL = (process.env.RACHDEV_CONTROL_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.RACHDEV_RUNTIME_TOKEN || '';
const PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
const LLM_KEY = process.env.LLM_API_KEY || '';
const MODEL_OVERRIDE = process.env.LLM_MODEL || null;
const PORT = Number(process.env.PORT) || 8080;

if (!CONTROL || !TOKEN) { console.error('[runtime-agent] RACHDEV_CONTROL_URL and RACHDEV_RUNTIME_TOKEN are required.'); process.exit(1); }
if (!LLM_KEY) console.warn('[runtime-agent] LLM_API_KEY is not set — /chat will error until it is.');

// ── State + rolling metrics (metadata only) ──────────────────────────────────
let spec = null;
let pollMs = 300_000;
let telemetryMs = 60_000;
const metrics = { runs_total: 0, runs_window: 0, errors_total: 0, tokens_in: 0, tokens_out: 0, latencies: [] };

const authHeaders = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' });

async function pullSpec() {
  try {
    const r = await fetch(`${CONTROL}/api/runtime/v1/spec`, { headers: authHeaders() });
    if (!r.ok) throw new Error(`spec pull ${r.status}`);
    const data = await r.json();
    spec = data.spec || null;
    if (data.poll_interval_seconds) pollMs = data.poll_interval_seconds * 1000;
    if (data.telemetry_interval_seconds) telemetryMs = data.telemetry_interval_seconds * 1000;
    console.log(`[runtime-agent] spec loaded: ${spec && (spec.name || spec.key)} v${data.version}`);
  } catch (e) {
    console.error('[runtime-agent] spec pull failed:', e.message);
  }
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

async function pushTelemetry(status = 'running') {
  try {
    const body = {
      status, runtime_version: VERSION,
      metrics: {
        runs_total: metrics.runs_total,
        runs_window: metrics.runs_window,
        errors_total: metrics.errors_total,
        tokens_in: metrics.tokens_in,
        tokens_out: metrics.tokens_out,
        p50_latency_ms: percentile(metrics.latencies, 50),
        p95_latency_ms: percentile(metrics.latencies, 95),
      },
    };
    await fetch(`${CONTROL}/api/runtime/v1/telemetry`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
    metrics.runs_window = 0; metrics.latencies = []; // reset the window
  } catch (e) {
    console.error('[runtime-agent] telemetry push failed:', e.message);
  }
}

// ── LLM call against the CUSTOMER's key (content stays local) ─────────────────
async function runLLM(messages) {
  const system = (spec && spec.prompt) || 'You are a helpful assistant.';
  const model = MODEL_OVERRIDE || (spec && spec.model_policy && spec.model_policy.pin) ||
    (PROVIDER === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001');

  if (PROVIDER === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LLM_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages] }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return { text: d.choices?.[0]?.message?.content || '', tokensIn: d.usage?.prompt_tokens || 0, tokensOut: d.usage?.completion_tokens || 0, model };
  }
  // anthropic (default)
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': LLM_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  const text = Array.isArray(d.content) ? d.content.filter((b) => b.type === 'text').map((b) => b.text).join('') : '';
  return { text, tokensIn: d.usage?.input_tokens || 0, tokensOut: d.usage?.output_tokens || 0, model };
}

async function handleChat(messages) {
  const t0 = Date.now();
  try {
    const out = await runLLM(messages);
    metrics.runs_total++; metrics.runs_window++;
    metrics.tokens_in += out.tokensIn; metrics.tokens_out += out.tokensOut;
    metrics.latencies.push(Date.now() - t0);
    return out;
  } catch (e) {
    metrics.errors_total++;
    throw e;
  }
}

// ── Local HTTP surface (stays on the customer's network) ─────────────────────
function readJson(req) {
  return new Promise((resolve) => {
    let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      return send(res, 200, { ok: true, version: VERSION, spec_loaded: !!spec, provider: PROVIDER });
    }
    if (req.method === 'POST' && (req.url === '/chat' || req.url.startsWith('/v1/chat/completions'))) {
      if (!spec) return send(res, 503, { error: 'Spec not loaded yet' });
      const body = await readJson(req);
      const messages = Array.isArray(body.messages) && body.messages.length
        ? body.messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: String(m.content || '') }))
        : [{ role: 'user', content: String(body.message || '') }];
      if (!messages.length || !messages.some((m) => m.content)) return send(res, 400, { error: 'message(s) required' });
      const out = await handleChat(messages);
      if (req.url.startsWith('/v1/chat/completions')) {
        return send(res, 200, {
          id: `chatcmpl-${Date.now().toString(36)}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: out.model,
          choices: [{ index: 0, message: { role: 'assistant', content: out.text }, finish_reason: 'stop' }],
          usage: { prompt_tokens: out.tokensIn, completion_tokens: out.tokensOut, total_tokens: out.tokensIn + out.tokensOut },
        });
      }
      return send(res, 200, { reply: out.text });
    }
    send(res, 404, { error: 'Not found' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

async function main() {
  await pullSpec();
  await pushTelemetry('running');
  setInterval(pullSpec, pollMs);
  setInterval(() => pushTelemetry('running'), telemetryMs);
  server.listen(PORT, () => console.log(`[runtime-agent] v${VERSION} listening on :${PORT} → control ${CONTROL}`));
}
// Best-effort "stopping" telemetry on shutdown.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { await pushTelemetry('stopped'); process.exit(0); });

if (require.main === module) main();
module.exports = { runLLM, handleChat, pullSpec, pushTelemetry, server, _metrics: metrics, _setSpec: (s) => { spec = s; } };
