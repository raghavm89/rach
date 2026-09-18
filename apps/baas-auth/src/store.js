'use strict';

/**
 * Auth store — the project's own user + refresh-token tables, living in the PROJECT database
 * (not the RachBase control plane). `ensureSchema` is idempotent so the service self-bootstraps
 * on first run. Takes any pg-like client with `.query` (real pg Pool in prod; pglite in tests).
 */

function makeStore(pool) {
  return {
    async ensureSchema() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id            BIGSERIAL PRIMARY KEY,
          email         TEXT UNIQUE,
          password_hash TEXT,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      // Additive columns (idempotent) — email confirmation + anonymous users.
      await pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN NOT NULL DEFAULT TRUE`);
      await pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE`);
      await pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS confirm_token TEXT`);
      // email/password may be null for anonymous users
      await pool.query(`ALTER TABLE auth_users ALTER COLUMN email DROP NOT NULL`).catch(() => {});
      await pool.query(`ALTER TABLE auth_users ALTER COLUMN password_hash DROP NOT NULL`).catch(() => {});

      // Refresh tokens — one row per issued token; rotation links parent→child via replaced_by,
      // and a whole family shares family_id so reuse of a spent token can revoke the lineage.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
          id          BIGSERIAL PRIMARY KEY,
          user_id     BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          token_hash  TEXT UNIQUE NOT NULL,
          family_id   TEXT NOT NULL,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          used_at     TIMESTAMPTZ,
          replaced_by TEXT,
          revoked_at  TIMESTAMPTZ
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS auth_refresh_family_idx ON auth_refresh_tokens (family_id)`);

      // OAuth Server (project-as-IdP): registered third-party client apps + short-lived auth codes.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          id                 BIGSERIAL PRIMARY KEY,
          client_id          TEXT UNIQUE NOT NULL,
          client_secret_hash TEXT,
          client_type        TEXT NOT NULL DEFAULT 'confidential',
          name               TEXT NOT NULL,
          redirect_uris      JSONB NOT NULL DEFAULT '[]',
          created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS oauth_auth_codes (
          code_hash             TEXT PRIMARY KEY,
          client_id             TEXT NOT NULL,
          user_id               BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
          redirect_uri          TEXT NOT NULL,
          scope                 TEXT,
          code_challenge        TEXT,
          code_challenge_method TEXT,
          expires_at            TIMESTAMPTZ NOT NULL,
          used_at               TIMESTAMPTZ
        );
      `);
    },

    // ── OAuth clients (registered third-party apps) ──
    async createOAuthClient({ clientId, clientSecretHash = null, clientType = 'confidential', name, redirectUris = [] }) {
      const { rows } = await pool.query(
        `INSERT INTO oauth_clients (client_id, client_secret_hash, client_type, name, redirect_uris)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, client_id, client_type, name, redirect_uris, created_at`,
        [clientId, clientSecretHash, clientType, name, JSON.stringify(redirectUris)]);
      return rows[0];
    },
    async findOAuthClient(clientId) {
      const { rows } = await pool.query('SELECT * FROM oauth_clients WHERE client_id = $1', [clientId]);
      return rows[0] || null;
    },
    async listOAuthClients() {
      const { rows } = await pool.query(
        'SELECT id, client_id, client_type, name, redirect_uris, created_at FROM oauth_clients ORDER BY created_at DESC');
      return rows;
    },
    async deleteOAuthClient(clientId) {
      const { rowCount } = await pool.query('DELETE FROM oauth_clients WHERE client_id = $1', [clientId]);
      return rowCount > 0;
    },

    // ── OAuth authorization codes (short-lived, single-use) ──
    async insertAuthCode({ codeHash, clientId, userId, redirectUri, scope = null, codeChallenge = null, codeChallengeMethod = null, expiresAt }) {
      await pool.query(
        `INSERT INTO oauth_auth_codes (code_hash, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [codeHash, clientId, userId, redirectUri, scope, codeChallenge, codeChallengeMethod, expiresAt]);
    },
    async findAuthCode(codeHash) {
      const { rows } = await pool.query('SELECT * FROM oauth_auth_codes WHERE code_hash = $1', [codeHash]);
      return rows[0] || null;
    },
    async markAuthCodeUsed(codeHash) {
      await pool.query('UPDATE oauth_auth_codes SET used_at = NOW() WHERE code_hash = $1', [codeHash]);
    },

    async findUserByEmail(email) {
      const { rows } = await pool.query('SELECT * FROM auth_users WHERE email = $1', [email]);
      return rows[0] || null;
    },
    async findUserById(id) {
      const { rows } = await pool.query('SELECT * FROM auth_users WHERE id = $1', [id]);
      return rows[0] || null;
    },
    async createUser({ email = null, password_hash = null, email_confirmed = true, is_anonymous = false, confirm_token = null }) {
      const { rows } = await pool.query(
        `INSERT INTO auth_users (email, password_hash, email_confirmed, is_anonymous, confirm_token)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [email, password_hash, email_confirmed, is_anonymous, confirm_token],
      );
      return rows[0];
    },
    // Rehash-on-login: swap a migrated bcrypt hash for native scrypt after a successful login.
    async setPasswordHash(id, password_hash) {
      await pool.query('UPDATE auth_users SET password_hash = $2 WHERE id = $1', [id, password_hash]);
    },
    // Right to correction (DPDP §12) — update the user's own mutable fields (email today).
    async updateUser(id, { email } = {}) {
      if (email == null) { const { rows } = await pool.query('SELECT * FROM auth_users WHERE id = $1', [id]); return rows[0] || null; }
      const { rows } = await pool.query('UPDATE auth_users SET email = $2 WHERE id = $1 RETURNING *', [id, String(email).toLowerCase()]);
      return rows[0] || null;
    },
    // Confirm an email via its one-time token. Returns the user, or null if the token is unknown.
    async confirmUserByToken(token) {
      const { rows } = await pool.query(
        `UPDATE auth_users SET email_confirmed = TRUE, confirm_token = NULL
          WHERE confirm_token = $1 RETURNING *`, [token]);
      return rows[0] || null;
    },

    // ── refresh tokens ──
    async insertRefresh({ userId, tokenHash, familyId }) {
      await pool.query(
        `INSERT INTO auth_refresh_tokens (user_id, token_hash, family_id) VALUES ($1, $2, $3)`,
        [userId, tokenHash, familyId]);
    },
    async findRefresh(tokenHash) {
      const { rows } = await pool.query('SELECT * FROM auth_refresh_tokens WHERE token_hash = $1', [tokenHash]);
      return rows[0] || null;
    },
    // Mark a token spent and link it to its successor (rotation).
    async markRefreshUsed(tokenHash, childHash) {
      await pool.query(
        `UPDATE auth_refresh_tokens SET used_at = NOW(), replaced_by = $2 WHERE token_hash = $1`,
        [tokenHash, childHash]);
    },
    // Revoke an entire token family (reuse detected → assume compromise).
    async revokeFamily(familyId) {
      await pool.query(
        `UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL`,
        [familyId]);
    },
    async revokeRefresh(tokenHash) {
      await pool.query(`UPDATE auth_refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [tokenHash]);
    },

    // ── admin (service_role) ──
    async listUsers({ limit = 50, offset = 0 } = {}) {
      const { rows } = await pool.query(
        'SELECT id, email, created_at, email_confirmed, is_anonymous FROM auth_users ORDER BY id DESC LIMIT $1 OFFSET $2', [Math.min(limit, 200), offset]);
      const { rows: c } = await pool.query('SELECT COUNT(*)::int AS total FROM auth_users');
      return { users: rows, total: c[0].total };
    },
    async deleteUser(id) {
      const { rowCount } = await pool.query('DELETE FROM auth_users WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}

module.exports = { makeStore };
