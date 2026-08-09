'use strict';

/**
 * Support tickets for RachDev. Reuses the shared `tickets` / `ticket_messages`
 * tables (migration 044_support_tickets) and satisfies the shared @rach/ui
 * `support` API contract, so the support page renders identically.
 *
 * Visibility (enforced in SQL):
 *  • admin (RachDev platform)  → all tickets
 *  • org admin (tenant_admin)  → their organization's tickets
 *  • everyone else             → their own tickets
 *
 * (No LLM support bot here; RachDev's support page is tickets-only.)
 */

const { pool } = require('@rach/core');

const STATUSES = new Set(['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed']);
const PAGE_SIZE = 20;

function isSupport(user) { return user.role === 'admin'; }

// Row-visibility predicate for a given user (t = tickets alias).
function scope(user) {
  if (isSupport(user)) return { clause: '', params: [] };
  if (user.role === 'tenant_admin' && user.tenant_id != null) {
    return { clause: 't.tenant_id = $1', params: [user.tenant_id] };
  }
  return { clause: 't.user_id = $1', params: [user.id] };
}

// POST /api/support/tickets
exports.createTicket = async (req, res) => {
  const { subject, body, category = 'other', priority = 'normal', source = 'human' } = req.body ?? {};
  if (!subject?.trim()) return res.status(400).json({ error: 'subject is required' });

  const { rows } = await pool.query(
    `INSERT INTO tickets (tenant_id, user_id, subject, body, category, priority, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.user.tenant_id ?? null, req.user.id, subject.trim(), body || null, category, priority, source]
  );
  const ticket = rows[0];

  if (body?.trim()) {
    await pool.query(
      `INSERT INTO ticket_messages (ticket_id, author_type, author_id, body)
       VALUES ($1, 'customer', $2, $3)`,
      [ticket.id, req.user.id, body.trim()]
    );
  }
  res.status(201).json({ ticket });
};

// GET /api/support/tickets?status=&page=
exports.listTickets = async (req, res) => {
  const { clause, params } = scope(req.user);
  const where = [];
  const args = [...params];
  if (clause) where.push(clause);
  if (STATUSES.has(req.query.status)) { args.push(req.query.status); where.push(`t.status = $${args.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM tickets t ${whereSql}`, args
  );
  const total = countRows[0].total;

  const { rows: tickets } = await pool.query(
    `SELECT t.*, u.name AS user_name, u.email AS user_email,
            (SELECT COUNT(*)::int FROM ticket_messages m WHERE m.ticket_id = t.id) AS message_count
       FROM tickets t
       JOIN users u ON u.id = t.user_id
       ${whereSql}
       ORDER BY t.updated_at DESC
       LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
    args
  );
  res.json({ tickets, total, page, limit: PAGE_SIZE });
};

async function fetchVisibleTicket(user, id) {
  const { clause, params } = scope(user);
  const args = [id, ...params];
  const extra = clause ? ` AND ${clause.replace('$1', `$${args.length}`)}` : '';
  const { rows } = await pool.query(`SELECT t.* FROM tickets t WHERE t.id = $1${extra}`, args);
  return rows[0] || null;
}

// GET /api/support/tickets/:id
exports.getTicket = async (req, res) => {
  const ticket = await fetchVisibleTicket(req.user, req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const { rows: messages } = await pool.query(
    `SELECT m.id, m.author_type, m.author_id, m.body, m.created_at, u.name AS author_name
       FROM ticket_messages m LEFT JOIN users u ON u.id = m.author_id
      WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
    [req.params.id]
  );
  // Don't leak support staff names to customers.
  if (!isSupport(req.user)) for (const m of messages) if (m.author_type === 'support') m.author_name = null;
  res.json({ ticket, messages });
};

// POST /api/support/tickets/:id/messages
exports.addMessage = async (req, res) => {
  const { body } = req.body ?? {};
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });

  const ticket = await fetchVisibleTicket(req.user, req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'closed') return res.status(409).json({ error: 'Ticket is closed — reopen it to reply' });

  const authorType = isSupport(req.user) ? 'support' : 'customer';
  const { rows } = await pool.query(
    `INSERT INTO ticket_messages (ticket_id, author_type, author_id, body)
     VALUES ($1, $2, $3, $4) RETURNING id, author_type, author_id, body, created_at`,
    [req.params.id, authorType, req.user.id, body.trim()]
  );

  // Support reply → awaiting the customer; customer reply → back to open.
  const nextStatus = authorType === 'support' ? 'waiting_on_customer' : 'open';
  await pool.query('UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, req.params.id]);

  res.status(201).json({ message: rows[0], status: nextStatus });
};

// PATCH /api/support/tickets/:id  (support/admin only for status/priority/assignment)
exports.updateTicket = async (req, res) => {
  if (!isSupport(req.user)) return res.status(403).json({ error: 'Only support can update tickets' });
  const ticket = await fetchVisibleTicket(req.user, req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const sets = [];
  const args = [];
  if (STATUSES.has(req.body.status)) {
    args.push(req.body.status); sets.push(`status = $${args.length}`);
    if (req.body.status === 'closed') sets.push('closed_at = NOW()');
    if (req.body.status === 'open')   sets.push('closed_at = NULL');
  }
  if (['low', 'normal', 'high', 'urgent'].includes(req.body.priority)) {
    args.push(req.body.priority); sets.push(`priority = $${args.length}`);
  }
  if (req.body.assigned_to !== undefined) {
    args.push(req.body.assigned_to); sets.push(`assigned_to = $${args.length}`);
  }
  if (!sets.length) return res.json({ ticket });

  args.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE tickets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${args.length} RETURNING *`,
    args
  );
  res.json({ ticket: rows[0] });
};
