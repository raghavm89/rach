'use strict';

/** BaaS Auth flows against a real DB (pglite): signup → login → user, with the errors that gate
 * each step. Sessions are verifiable per-project JWTs. */

const test = require('node:test');
const assert = require('node:assert/strict');
const baas = require('@rach/baas');
const A = require('../src/auth');
const { makeStore } = require('../src/store');

const HAVE_PGLITE = (() => { try { require.resolve('@electric-sql/pglite'); return true; } catch { return false; } })();
const REF = 'p0123456789abcdef';
const SECRET = baas.generateSecret();
const ctx = { ref: REF, secret: SECRET };

let store;
test.before(async () => {
  if (!HAVE_PGLITE) return;
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  store = makeStore({ query: (t, p) => (p === undefined ? db.query(t) : db.query(t, p)) });
  await store.ensureSchema();
});

test('signup creates a user and returns a verifiable session', { skip: !HAVE_PGLITE }, async () => {
  const r = await A.signup(store, ctx, { email: 'A@Example.com ', password: 'hunter2pw' });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.email, 'a@example.com'); // normalized
  const claims = baas.verifyToken(SECRET, r.body.access_token, { ref: REF });
  assert.equal(claims.role, 'authenticated');
  assert.equal(String(claims.sub), String(r.body.user.id));
  assert.equal(claims.email, 'a@example.com');
});

test('signup rejects bad email, weak password, and duplicates', { skip: !HAVE_PGLITE }, async () => {
  assert.equal((await A.signup(store, ctx, { email: 'nope', password: 'hunter2pw' })).status, 400);
  assert.equal((await A.signup(store, ctx, { email: 'b@example.com', password: 'short' })).status, 400);
  await A.signup(store, ctx, { email: 'dup@example.com', password: 'hunter2pw' });
  assert.equal((await A.signup(store, ctx, { email: 'dup@example.com', password: 'hunter2pw' })).status, 409);
});

test('login verifies the password (wrong/unknown → 400) and returns a session', { skip: !HAVE_PGLITE }, async () => {
  await A.signup(store, ctx, { email: 'log@example.com', password: 'correct-horse' });
  assert.equal((await A.login(store, ctx, { email: 'log@example.com', password: 'wrong' })).status, 400);
  assert.equal((await A.login(store, ctx, { email: 'ghost@example.com', password: 'correct-horse' })).status, 400);
  const ok = await A.login(store, ctx, { email: 'log@example.com', password: 'correct-horse' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.access_token);
});

test('getUser resolves the token to the user; bad token → 401', { skip: !HAVE_PGLITE }, async () => {
  const s = await A.signup(store, ctx, { email: 'me@example.com', password: 'hunter2pw' });
  const me = await A.getUser(store, ctx, s.body.access_token);
  assert.equal(me.status, 200);
  assert.equal(me.body.email, 'me@example.com');
  assert.equal((await A.getUser(store, ctx, 'garbage')).status, 401);
  // a token from another project is rejected
  const foreign = baas.mintUserToken(baas.generateSecret(), REF, { sub: '1' });
  assert.equal((await A.getUser(store, ctx, foreign)).status, 401);
});

test('admin: list + create + delete users (powers the dashboard Users screen)', { skip: !HAVE_PGLITE }, async () => {
  const before = (await A.listUsers(store, {})).body.total;
  const created = await A.adminCreateUser(store, ctx, { email: 'admin-made@example.com', password: 'hunter2pw' });
  assert.equal(created.status, 201);
  assert.equal(created.body.email, 'admin-made@example.com');
  const list = await A.listUsers(store, { limit: 100 });
  assert.equal(list.body.total, before + 1);
  assert.ok(list.body.users.some((u) => u.email === 'admin-made@example.com'));
  assert.equal((await A.adminCreateUser(store, ctx, { email: 'admin-made@example.com', password: 'hunter2pw' })).status, 409); // dup
  assert.equal((await A.adminDeleteUser(store, created.body.id)).status, 200);
  assert.equal((await A.adminDeleteUser(store, created.body.id)).status, 404); // already gone
});

test('with a signing key, sessions are ES256 (asymmetric) and verify with the public key', { skip: !HAVE_PGLITE }, async () => {
  const kp = baas.signing.generateSigningKeypair();
  const asymCtx = { ref: REF, secret: SECRET, signingKey: { privatePem: kp.privatePem, publicPem: kp.publicPem, kid: kp.kid } };

  const r = await A.signup(store, asymCtx, { email: 'asym@example.com', password: 'hunter2pw' });
  assert.equal(r.status, 201);
  // verifies with the PUBLIC key (no shared secret needed) ...
  const claims = baas.signing.verifyTokenAsym(kp.publicPem, r.body.access_token, { ref: REF });
  assert.equal(claims.role, 'authenticated');
  assert.equal(claims.email, 'asym@example.com');
  // ... and does NOT verify as an HS256 token against the secret
  assert.throws(() => baas.verifyToken(SECRET, r.body.access_token, { ref: REF }));
  // getUser accepts the asymmetric token (verifySession tries the public key first)
  assert.equal((await A.getUser(store, asymCtx, r.body.access_token)).status, 200);
});

test('config gates: signups can be disabled and the token TTL is configurable', { skip: !HAVE_PGLITE }, async () => {
  // signups disabled → 403
  const noSignup = await A.signup(store, { ...ctx, allowSignups: false }, { email: 'blocked@example.com', password: 'hunter2pw' });
  assert.equal(noSignup.status, 403);
  assert.equal(noSignup.body.error, 'signups_disabled');

  // custom TTL flows into the session's expires_in and the token exp
  const r = await A.signup(store, { ...ctx, ttlSec: 900 }, { email: 'ttl@example.com', password: 'hunter2pw' });
  assert.equal(r.body.expires_in, 900);
  const claims = baas.verifyToken(SECRET, r.body.access_token, { ref: REF });
  assert.equal(claims.exp - claims.iat, 900);
});

test('refresh rotation: a used token is rotated; replaying a spent token revokes the family', { skip: !HAVE_PGLITE }, async () => {
  const rctx = { ...ctx, refreshRotation: true, refreshReuseInterval: 0 };
  const s = await A.signup(store, rctx, { email: 'rot@example.com', password: 'hunter2pw' });
  const rt0 = s.body.refresh_token;
  assert.ok(rt0);

  const r1 = await A.refreshSession(store, rctx, { refresh_token: rt0 });
  assert.equal(r1.status, 200);
  const rt1 = r1.body.refresh_token;
  assert.notEqual(rt1, rt0);                                   // rotated

  // replaying the spent rt0 (past the 0s interval) is treated as theft → family revoked
  const reuse = await A.refreshSession(store, rctx, { refresh_token: rt0 });
  assert.equal(reuse.status, 401);
  assert.equal(reuse.body.error, 'refresh_token_reused');
  // the rotated child is now revoked too
  assert.equal((await A.refreshSession(store, rctx, { refresh_token: rt1 })).status, 401);
});

test('refresh rotation disabled: the same refresh token keeps working', { skip: !HAVE_PGLITE }, async () => {
  const rctx = { ...ctx, refreshRotation: false };
  const s = await A.signup(store, rctx, { email: 'norot@example.com', password: 'hunter2pw' });
  const rt = s.body.refresh_token;
  const a = await A.refreshSession(store, rctx, { refresh_token: rt });
  assert.equal(a.status, 200);
  assert.equal(a.body.refresh_token, rt);                     // unchanged
  assert.ok(a.body.access_token);
  assert.equal((await A.refreshSession(store, rctx, { refresh_token: rt })).status, 200); // still valid
});

test('anonymous sign-ins are gated by config', { skip: !HAVE_PGLITE }, async () => {
  assert.equal((await A.signupAnonymous(store, { ...ctx, allowAnonymous: false })).status, 403);
  const r = await A.signupAnonymous(store, { ...ctx, allowAnonymous: true });
  assert.equal(r.status, 201);
  assert.equal(r.body.user.is_anonymous, true);
  assert.ok(r.body.access_token && r.body.refresh_token);
});

test('email confirmation gate: no session until verified; login blocked meanwhile', { skip: !HAVE_PGLITE }, async () => {
  const cctx = { ...ctx, confirmEmail: true, mailerConfigured: false };
  const s = await A.signup(store, cctx, { email: 'confirm@example.com', password: 'hunter2pw' });
  assert.equal(s.status, 200);
  assert.equal(s.body.confirmation_required, true);
  assert.ok(!s.body.access_token);                            // no session yet
  assert.ok(s.body.confirmation_token);                       // dev: token surfaced (no mailer)

  // login is blocked until confirmed
  assert.equal((await A.login(store, cctx, { email: 'confirm@example.com', password: 'hunter2pw' })).body.error, 'email_not_confirmed');

  // verify → session; then login works
  const v = await A.verifyEmail(store, cctx, { token: s.body.confirmation_token });
  assert.equal(v.status, 200);
  assert.ok(v.body.access_token);
  assert.equal((await A.login(store, cctx, { email: 'confirm@example.com', password: 'hunter2pw' })).status, 200);
});

test('confirmation email is sent via the mailer; token withheld when a mailer is configured', { skip: !HAVE_PGLITE }, async () => {
  let sent = null;
  const mctx = { ...ctx, confirmEmail: true, mailerConfigured: true, projectUrl: 'https://p1.rachbase.app', siteUrl: 'https://app.example.com',
    mailer: async (m) => { sent = m; return { sent: true }; } };
  const s = await A.signup(store, mctx, { email: 'mailed@example.com', password: 'hunter2pw' });
  assert.equal(s.status, 200);
  assert.ok(!s.body.confirmation_token);                     // not surfaced once a mailer exists
  assert.equal(sent.to, 'mailed@example.com');
  assert.match(sent.htmlContent, /\/auth\/v1\/verify\?token=/);
  assert.match(sent.htmlContent, /redirect_to=/);
});

test('password hashing round-trips and rejects tampering', () => {
  const h = A.hashPassword('s3cret-pw');
  assert.ok(A.verifyPassword('s3cret-pw', h));
  assert.ok(!A.verifyPassword('other', h));
  assert.ok(!A.verifyPassword('s3cret-pw', 'not-a-hash'));
});
