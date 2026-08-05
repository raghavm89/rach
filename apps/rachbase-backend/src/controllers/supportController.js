'use strict';

/**
 * Support tickets — customer-raised (or bot-raised) issues, tracked to
 * resolution. Every handler is scoped by role:
 *   admin        → all tickets (support staff)
 *   tenant_admin → all tickets in their tenant
 *   others       → only their own tickets
 *
 * The scoping lives in SQL (tenant_id / user_id predicates) so it holds
 * regardless of what the client asks for.
 */

const { pool } = require('@rach/core');
const { sendSupportEmail } = require('@rach/core').brevo;

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL || process.env.SELLER_EMAIL || process.env.BREVO_FROM_EMAIL || null;
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const dashLink = () => (APP_URL ? `<p><a href="${APP_URL}/dashboard/support">Open in dashboard</a></p>` : '');

// Fire-and-forget ticket notifications. Never block or fail the request on email.
function notify(promise) { Promise.resolve(promise).catch((e) => console.error('[support] notify failed:', e.message)); }

async function emailForUser(userId) {
  const { rows } = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
  return rows[0] || null;
}

const STATUSES   = new Set(['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const CATEGORIES = new Set(['billing', 'deployment', 'vm', 'account', 'other']);

// Is this user support staff (can answer/triage any ticket)?
function isSupport(user) { return user.role === 'admin'; }

// SQL predicate + params that limit which tickets a user may see. Columns are
// qualified with the `t` alias because list queries join `users` (which also has
// a tenant_id) — an unqualified `tenant_id` would be ambiguous.
function visibilityScope(user) {
  if (isSupport(user))            return { clause: '', params: [] };
  if (user.role === 'tenant_admin' && user.tenant_id != null)
                                  return { clause: 't.tenant_id = $1', params: [user.tenant_id] };
  return { clause: 't.user_id = $1', params: [user.id] };
}

// Fetch a ticket only if the caller is allowed to see it, else null.
async function loadVisibleTicket(id, user) {
  const { clause, params } = visibilityScope(user);
  const where = clause ? `t.id = $${params.length + 1} AND ${clause}` : 't.id = $1';
  const { rows } = await pool.query(
    `SELECT t.* FROM tickets t WHERE ${where}`,
    clause ? [...params, id] : [id]
  );
  return rows[0] || null;
}

// POST /api/support/tickets   { subject, body, category?, priority?, source? }
exports.createTicket = async (req, res) => {
  const subject = String(req.body.subject || '').trim();
  const body    = String(req.body.body || '').trim() || null;
  if (!subject) return res.status(400).json({ error: 'subject is required' });

  const category = CATEGORIES.has(req.body.category) ? req.body.category : 'other';
  const priority = PRIORITIES.has(req.body.priority) ? req.body.priority : 'normal';
  const source   = req.body.source === 'bot' ? 'bot' : 'human';

  const { rows } = await pool.query(
    `INSERT INTO tickets (tenant_id, user_id, subject, body, category, priority, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user.tenant_id ?? null, req.user.id, subject, body, category, priority, source]
  );
  const ticket = rows[0];

  if (body) {
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, author_type, author_id, body)
       VALUES ($1, 'customer', $2, $3)`,
      [ticket.id, req.user.id, body]
    );
  }

  // Notify the support inbox of the new ticket. The JWT carries no name, so look
  // it up for a friendlier "raised by" line (falls back to email / id).
  if (SUPPORT_INBOX) notify((async () => {
    const raiser = await emailForUser(req.user.id);
    const who = raiser?.name || req.user.email || `user #${req.user.id}`;
    return sendSupportEmail({
      to: SUPPORT_INBOX,
      subject: `New ticket #${ticket.id} · ${subject}`,
      html: `<p>A new <b>${ticket.priority}</b> ${ticket.category} ticket was raised${source === 'bot' ? ' via the assistant' : ''} by <b>${esc(who)}</b>.</p>`
          + `<p><b>${esc(subject)}</b></p>${body ? `<blockquote>${esc(body)}</blockquote>` : ''}${dashLink()}`,
    });
  })());

  res.status(201).json({ ticket });
};

// GET /api/support/tickets?status=&page=&limit=
exports.listTickets = async (req, res) => {
  const { clause, params } = visibilityScope(req.user);
  const where = [];
  const args  = [...params];
  if (clause) where.push(clause);
  if (STATUSES.has(req.query.status)) { args.push(req.query.status); where.push(`t.status = $${args.length}`); }

  const page   = Math.max(1, parseInt(req.query.page  || '1', 10));
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS user_name, u.email AS user_email,
            (SELECT COUNT(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       ${whereSql}
      ORDER BY t.updated_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
    args
  );
  const { rows: c } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM tickets t ${whereSql}`, args
  );
  res.json({ tickets: rows, total: c[0].total, page, limit });
};

// GET /api/support/tickets/:id  (+ messages)
exports.getTicket = async (req, res) => {
  const ticket = await loadVisibleTicket(req.params.id, req.user);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const { rows: messages } = await pool.query(
    `SELECT m.id, m.author_type, m.author_id, m.body, m.created_at, u.name AS author_name
       FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id
      WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
    [ticket.id]
  );
  // Don't leak support staff's real names to customers — the client shows a
  // generic "Support" label for those messages anyway.
  if (!isSupport(req.user)) {
    for (const m of messages) if (m.author_type === 'support') m.author_name = null;
  }
  res.json({ ticket, messages });
};

// POST /api/support/tickets/:id/messages   { body }
exports.addMessage = async (req, res) => {
  const ticket = await loadVisibleTicket(req.params.id, req.user);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  if (ticket.status === 'closed') return res.status(409).json({ error: 'Ticket is closed — reopen it to reply' });

  const authorType = isSupport(req.user) ? 'support' : 'customer';
  // A support reply awaits the customer; a customer reply reopens the queue.
  const nextStatus = authorType === 'support' ? 'waiting_on_customer' : 'open';

  // Insert the message and advance status atomically so the thread and the
  // ticket status can never drift if one statement fails.
  const client = await pool.connect();
  let rows;
  try {
    await client.query('BEGIN');
    ({ rows } = await client.query(
      `INSERT INTO ticket_messages (ticket_id, author_type, author_id, body)
       VALUES ($1, $2, $3, $4) RETURNING id, author_type, author_id, body, created_at`,
      [ticket.id, authorType, req.user.id, body]
    ));
    await client.query(
      `UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2`,
      [nextStatus, ticket.id]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Notify the other party: support → the customer; customer → the support inbox.
  if (authorType === 'support') {
    notify((async () => {
      const owner = await emailForUser(ticket.user_id);
      if (owner?.email) return sendSupportEmail({
        to: owner.email,
        subject: `Support replied on your ticket #${ticket.id}`,
        html: `<p>Hi ${esc(owner.name || 'there')}, support replied on <b>${esc(ticket.subject)}</b>:</p><blockquote>${esc(body)}</blockquote>${dashLink()}`,
      });
    })());
  } else if (SUPPORT_INBOX) {
    notify(sendSupportEmail({
      to: SUPPORT_INBOX,
      subject: `Customer reply on ticket #${ticket.id} · ${ticket.subject}`,
      html: `<p>The customer replied on <b>${esc(ticket.subject)}</b>:</p><blockquote>${esc(body)}</blockquote>${dashLink()}`,
    }));
  }

  res.status(201).json({ message: rows[0], status: nextStatus });
};

// PATCH /api/support/tickets/:id   { status?, priority?, assigned_to? }
exports.updateTicket = async (req, res) => {
  const ticket = await loadVisibleTicket(req.params.id, req.user);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const support = isSupport(req.user);
  const sets = [];
  const args = [];

  if (req.body.status !== undefined) {
    if (!STATUSES.has(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    // Customers may only close or reopen their own ticket; support sets any status.
    if (!support && !['closed', 'open'].includes(req.body.status)) {
      return res.status(403).json({ error: 'Only support can set that status' });
    }
    args.push(req.body.status); sets.push(`status = $${args.length}`);
    if (req.body.status === 'closed') sets.push('closed_at = NOW()');
    if (req.body.status === 'open')   sets.push('closed_at = NULL');
  }
  if (support && req.body.priority !== undefined) {
    if (!PRIORITIES.has(req.body.priority)) return res.status(400).json({ error: 'Invalid priority' });
    args.push(req.body.priority); sets.push(`priority = $${args.length}`);
  }
  if (support && req.body.assigned_to !== undefined) {
    const assignee = req.body.assigned_to || null;
    if (assignee !== null) {
      // Only support/admin staff may own a ticket — reject arbitrary user ids
      // (an unchecked id would otherwise 500 on the FK or assign to a customer).
      const { rows: a } = await pool.query(
        `SELECT 1 FROM users WHERE id = $1 AND role = 'admin'`, [assignee]
      );
      if (!a.length) return res.status(400).json({ error: 'assigned_to must be a support user' });
    }
    args.push(assignee); sets.push(`assigned_to = $${args.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  args.push(ticket.id);
  const { rows } = await pool.query(
    `UPDATE tickets SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${args.length} RETURNING *`,
    args
  );
  res.json({ ticket: rows[0] });
};
