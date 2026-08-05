'use strict';

/**
 * Support Assistant — a deterministic, rule-based bot (NO LLM).
 *
 * It matches the customer's message to an intent (or takes an explicit intent
 * from a quick-reply button) and answers from a read-only, tenant/user-scoped
 * snapshot of THEIR OWN data, or from a canned features/pricing/how-to set.
 *
 * Why rule-based: free, always available (no external API), and structurally
 * incapable of answering anything outside RachBase — there is no general model
 * to jailbreak and no per-message token cost. Anything it can't handle routes to
 * a support ticket.
 */

const { pool } = require('@rach/core');
const catalogJson = require('@rach/billing/catalog.json');

const money = (m, cur) => `${cur === 'INR' ? '₹' : '$'}${(Number(m) / 100).toFixed(2)}`;

// Quick-reply buttons offered with most replies. `action: raise_ticket` is
// handled by the client (opens the ticket form); the rest send an intent back.
const QUICK = [
  { label: 'Order status',   intent: 'orders' },
  { label: 'Deployments',    intent: 'deployments' },
  { label: 'My VMs',         intent: 'vms' },
  { label: 'My plan',        intent: 'plan' },
  { label: 'Credits',        intent: 'credits' },
  { label: 'Pricing',        intent: 'pricing' },
  { label: 'Raise a ticket', action: 'raise_ticket' },
];

// Read-only snapshot of the caller's OWN account — every query scoped by
// tenant_id / user_id, so no other customer's data is reachable.
async function accountSnapshot(user) {
  const tid = user.tenant_id ?? null;
  const [subs, orders, vms, deps, tickets, credits] = await Promise.all([
    pool.query(
      `SELECT p.name, p.amount, p.currency, s.status, s.current_end
         FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 10`, [user.id]),
    tid == null ? { rows: [] } : pool.query(
      `SELECT id, custom_description, status, subscription_status, amount_paid, currency, requested_at
         FROM vm_expansion_requests WHERE tenant_id = $1 ORDER BY requested_at DESC LIMIT 10`, [tid]),
    tid == null ? { rows: [] } : pool.query(
      `SELECT vm_id, ip_address FROM vm_ssh_config WHERE tenant_id = $1 LIMIT 20`, [tid]),
    tid == null ? { rows: [] } : pool.query(
      `SELECT id, repo_full_name, branch, status FROM deployment_services WHERE tenant_id = $1 LIMIT 20`, [tid]),
    pool.query(
      `SELECT id, subject, status FROM tickets WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10`, [user.id]),
    tid == null ? { rows: [] } : pool.query(
      `SELECT balance FROM tenant_credits WHERE tenant_id = $1`, [tid]),
  ]);
  return {
    subscriptions: subs.rows.map((r) => `${r.name} — ${r.status}${r.current_end ? `, renews ${new Date(r.current_end).toISOString().slice(0,10)}` : ''} (${money(r.amount, r.currency)}/mo)`),
    orders:        orders.rows.map((r) => `#${r.id} ${r.custom_description || 'order'} — ${r.status}${r.subscription_status ? `/${r.subscription_status}` : ''}, ${money(r.amount_paid, r.currency)} (${new Date(r.requested_at).toISOString().slice(0,10)})`),
    vms:           vms.rows.map((r) => `${r.vm_id} — ${r.ip_address}`),
    deployments:   deps.rows.map((r) => `#${r.id} ${r.repo_full_name}@${r.branch} — ${r.status}`),
    tickets:       tickets.rows.map((r) => `#${r.id} "${r.subject}" — ${r.status}`),
    credits:       credits.rows[0]?.balance ?? 0,
  };
}

const bullets = (arr, empty) => (arr.length ? arr.map((x) => `• ${x}`).join('\n') : empty);

function matchIntent(msg) {
  const m = msg.toLowerCase();
  if (/^\s*(hi|hello|hey|yo|help|menu|start)\b/.test(m)) return 'greeting';
  if (/\bhow\b/.test(m)) {
    if (/deploy/.test(m))               return 'howto_deploy';
    if (/domain|url|https|dns/.test(m)) return 'howto_domain';
    if (/ssh|terminal|console/.test(m)) return 'howto_ssh';
    if (/log/.test(m))                  return 'howto_logs';
  }
  if (/ticket|human|agent|contact|talk to/.test(m))       return 'ticket';
  if (/order|purchase|bought|receipt/.test(m))            return 'orders';
  if (/deploy|build|service|\bapp\b/.test(m))             return 'deployments';
  if (/\bvms?\b|cluster|machine|provision|server/.test(m))return 'vms';
  if (/plan|subscription|renew/.test(m))                  return 'plan';
  if (/credit|balance|token/.test(m))                     return 'credits';
  if (/pric|cost|how much|charge|bill/.test(m))           return 'pricing';
  if (/feature|capab|what can/.test(m))                   return 'features';
  return 'fallback';
}

function pricingReply() {
  const c = catalogJson;
  const svcs    = c.services.filter((s) => !s.hidden).map((s) => `• ${s.name} — ${money(s.unit_price_cents, c.currency)} ${s.unit}`).join('\n');
  const bundles = c.bundles.map((b) => `• ${b.name} — ${money(b.price_cents, c.currency)}/mo`).join('\n');
  return `Our pricing (USD):\n\nServices:\n${svcs}\n\nBundles:\n${bundles}\n\nDeployment logs are free with a VM/Cluster; live runtime logs are the VM Logs add-on. Agent credits are sold in packs.`;
}

// Intents that read the caller's account snapshot. Everything else (greeting,
// pricing, features, how-tos, ticket, fallback) is canned and needs no DB reads.
const ACCOUNT_INTENTS = new Set(['orders', 'deployments', 'vms', 'plan', 'credits', 'tickets']);

// POST /api/support/chat   { message?, intent? }  → { reply, options }
exports.chat = async (req, res) => {
  const message = String(req.body.message || '').trim();
  const intent  = req.body.intent || (message ? matchIntent(message) : 'greeting');

  // Only hit the database for intents that actually surface account data.
  let snap = { subscriptions: [], orders: [], vms: [], deployments: [], tickets: [], credits: 0 };
  if (ACCOUNT_INTENTS.has(intent)) {
    try { snap = await accountSnapshot(req.user); }
    catch (e) { console.error('[support/chat] snapshot failed:', e.message); return res.status(500).json({ error: 'Could not load your account' }); }
  }

  let reply;
  switch (intent) {
    case 'greeting':
      reply = "Hi! I'm the RachBase assistant. I can check your orders, deployments, VMs, plan and credits, answer pricing or how-to questions, or raise a support ticket. What do you need?";
      break;
    case 'orders':      reply = `Your recent orders:\n${bullets(snap.orders, 'You have no orders yet.')}`; break;
    case 'deployments': reply = `Your deployments:\n${bullets(snap.deployments, 'No deployments yet — connect a GitHub repo from VM Deployment to ship one.')}`; break;
    case 'vms':         reply = `Your VMs / Clusters:\n${bullets(snap.vms, 'No VMs provisioned yet.')}`; break;
    case 'plan':        reply = `Your subscriptions:\n${bullets(snap.subscriptions, 'No active subscription yet.')}`; break;
    case 'credits':     reply = `Your agent credit balance is ${snap.credits}.`; break;
    case 'tickets':     reply = `Your recent tickets:\n${bullets(snap.tickets, 'No tickets yet.')}`; break;
    case 'pricing':     reply = pricingReply(); break;
    case 'features':    reply = 'RachBase gives you: VMs & Clusters, managed PostgreSQL, one-click GitHub deploys, free subdomains with automatic HTTPS, an in-browser SSH console, deployment & runtime logs, monitoring, and AI agent credits.'; break;
    case 'howto_deploy':reply = 'To deploy: open VM Deployment → click the + on a VM → pick a GitHub repo and branch → Deploy. It builds on the VM and goes live.'; break;
    case 'howto_domain':reply = "In a service's Domains tab, type a name and click Generate — you'll get <name>.rachbase.app with automatic HTTPS."; break;
    case 'howto_ssh':   reply = 'Open a VM and click the terminal icon (or the Console tab on a service) for an in-browser SSH session.'; break;
    case 'howto_logs':  reply = "Deployment logs are on a service's Deployments tab (free with your VM/Cluster). Live runtime logs are on the Logs tab (VM Logs add-on)."; break;
    case 'ticket':      reply = "I can open a support ticket for you — click “Raise a ticket” below and I'll include this chat so the team has context."; break;
    default:            reply = "I can help with your orders, deployments, VMs, plan, credits, pricing, or how-tos. For anything else, raise a ticket. Pick one:";
  }

  res.json({ reply, options: QUICK });
};
