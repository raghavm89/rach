'use strict';

/**
 * Create (or promote) a RachDev platform admin.
 *
 * Self-registration is disabled and the register endpoint refuses the `admin`
 * role, so the first admin must be created out-of-band. Once one admin exists,
 * everyone else can be added from the dashboard Users page (POST /api/users).
 *
 *   node apps/rachdev-backend/scripts/create-admin.js <email> <password> ["Full Name"] [phone]
 *
 * Examples:
 *   node apps/rachdev-backend/scripts/create-admin.js you@rachdev.com 'S3cret!' "Raghav" +919812345678
 *
 * - If the email already exists, the account is promoted to admin and its
 *   password is reset to the one given.
 * - Sets email_verified + phone_verified = true so login works immediately
 *   (login requires phone_verified). A placeholder phone is generated if none
 *   is supplied (phone_number is NOT NULL + UNIQUE in the schema).
 * - tenant_id stays NULL — a platform admin belongs to no workspace.
 *
 * Reads DB connection from the same env the backend uses (DB_HOST/DB_PORT/…
 * or DATABASE_URL). Run it with that env available (e.g. a prod shell).
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('@rach/core');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const password = process.argv[3] || '';
  const name = (process.argv[4] || 'RachDev Admin').trim();
  const phone = (process.argv[5] || `+1${Date.now().toString().slice(-10)}`).trim();

  if (!email || !password) {
    console.error('Usage: node scripts/create-admin.js <email> <password> ["Full Name"] [phone]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Refusing: choose a password of at least 8 characters.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  const existing = await pool.query('SELECT id, role FROM users WHERE lower(email) = lower($1)', [email]);

  if (existing.rows.length) {
    const { id, role } = existing.rows[0];
    await pool.query(
      `UPDATE users
         SET role = 'admin', password_hash = $2,
             email_verified = TRUE, phone_verified = TRUE, updated_at = NOW()
       WHERE id = $1`,
      [id, hash]
    );
    console.log(`✓ Promoted existing user to admin: ${email} (was "${role}", id ${id}). Password reset.`);
  } else {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, phone_number, role, email_verified, phone_verified, tenant_id)
       VALUES ($1, lower($2), $3, $4, 'admin', TRUE, TRUE, NULL)
       RETURNING id`,
      [name, email, hash, phone]
    );
    console.log(`✓ Created RachDev admin: ${email} (id ${rows[0].id}). Sign in at /login.`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Failed to create admin:', err.message);
    pool.end().finally(() => process.exit(1));
  });
