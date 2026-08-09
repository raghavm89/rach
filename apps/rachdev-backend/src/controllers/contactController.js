'use strict';

/**
 * Public sales-lead capture from the marketing contact / "talk to us" form.
 * No auth — prospects submit before an org exists. Persists the lead and, best
 * effort, notifies sales by email (never fails the request on email trouble).
 */

const { pool, brevo } = require('@rach/core');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.createLead = async (req, res) => {
  const { name, email, company, goal, source, meta } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
  if (!email || !EMAIL_RE.test(String(email))) return res.status(400).json({ error: 'a valid email is required' });

  const { rows } = await pool.query(
    `INSERT INTO leads (name, email, company, source, goal, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, created_at`,
    [
      String(name).trim(), String(email).trim(), (company || '').trim() || null,
      source || 'contact', goal || null, JSON.stringify(meta || {}),
    ]
  );

  // Best-effort sales notification — email config may be absent in dev.
  try {
    const parts = String(name).trim().split(' ');
    await brevo.sendContactEmail({
      firstName: parts[0] || name,
      lastName: parts.slice(1).join(' '),
      email,
      company,
      subject: (meta && meta.subject) || 'pricing',
      message: goal || '',
    });
  } catch (err) {
    console.warn('[leads] sales email notification failed:', err.message);
  }

  res.status(201).json({ ok: true, id: rows[0].id });
};
