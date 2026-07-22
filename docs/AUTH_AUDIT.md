# Rachbase — Signup / Login Path Audit

Scope: `packages/identity` (authController, auth routes, oauth routes, user/refreshToken models),
`packages/core/src/middleware/rateLimit.js`, `packages/core/src/db/migrations`,
`packages/ui` (AuthContext, api client), `apps/rachbase-web/src/app/(auth)/*`.

---

## P0 — Broken at runtime

### 1. `users.password_hash` does not exist — the column is `password`

`001_initial_schema.sql` defines `password VARCHAR(255)`. No migration ever renames it or adds
`password_hash`. Three code paths write to the non-existent column and will throw Postgres
`42703 undefined_column`:

| File | Line | Effect |
|---|---|---|
| `authController.js` | 508 | **Password reset is completely broken.** User gets the email, clicks the link, submits — 500. |
| `oauth.js` | 75 | **OAuth signup broken for new users.** Existing users log in fine; first-time Google/GitHub users always fail. |
| `userController.js` | 320 | **Change-password from the profile page broken.** |

Confusingly, `pending_registrations` *does* have a real `password_hash` column (016), which is why
`register` and `verifyEmail` work — that's the source of the naming drift.

Fix: either add `ALTER TABLE users RENAME COLUMN password TO password_hash` as a new migration and
update `User.create` / `login`, or change the three sites above to `password`. Renaming is cleaner —
the rest of the codebase already assumes `password_hash`.

### 2. OAuth callback redirects to a route that doesn't exist

`oauth.js:46` redirects to `${APP_URL}/auth/callback`.
The Next.js route is `app/(auth)/auth-callback/page.tsx` → **`/auth-callback`**.

Every OAuth sign-in lands on a 404. Same for the error path (`oauth.js:50`).

### 3. OAuth sessions have no refresh token

`issueAccessToken()` mints an 8h JWT and never calls `issueTokens()`, so no `refresh_token` cookie
is set. On the next page load `AuthContext.init()` calls `auth.refresh()` → 401 → localStorage
cleared → the user is silently signed out. OAuth users effectively cannot hold a session.

### 4. `auth-callback` calls `login()` with the wrong signature

```ts
// auth-callback/page.tsx:36
login(token, user);          // AuthContext.login is (email: string, password: string)
```

This fires a real `POST /api/auth/login` with the JWT as the email. The promise isn't awaited, so it
rejects unhandled while `router.replace('/dashboard')` runs anyway — React state is never populated,
only localStorage. Should be `setSession(token, user)`, which already exists and does the right thing.

---

## P1 — Security

### 5. Login leaks which emails are registered

`login()` goes to real trouble to avoid a timing oracle (`DUMMY_BCRYPT_HASH`, always running bcrypt),
then throws it away four lines later by returning `404 { no_account: true }` when the email is
unknown vs `401 Invalid credentials` when it exists. Anyone can enumerate your user base.

The frontend depends on this (the amber "No account found" card). Worth deciding explicitly whether
that UX is worth the disclosure — most products return a generic "Invalid email or password".

### 6. Dead branch — the "registered but unverified" flow never fires

```js
if (pending.length) { return res.status(404).json({ ...no_account: true }); }
return res.status(404).json({ ...no_account: true });   // identical
```

Both branches return the same body, and neither returns `pending_id`. The frontend handler at
`login/page.tsx:117` (`if (e2.pending_id)`) is therefore unreachable: a user who signs up, abandons
the OTP screen, then tries to log in is told "no account exists" — and if they re-register, the
`ON CONFLICT` upsert quietly resets their pending row. Confusing dead end for a real user.

The pending branch should return `pending_id` and a 403-ish "finish verifying your email".

### 7. Access-token lifetime mismatch — sessions die after ~15 minutes

- `JWT_ACCESS_EXPIRES_IN` defaults to `'15m'` (`authController.js:55`)
- OAuth hardcodes `'8h'` (`oauth.js:29`)
- `AuthContext` proactively refreshes every **7 hours**, with the comment *"access token lifetime is 8h"*

Unless the env var is set to 8h in every environment, password users start getting 401s a quarter of
an hour in, and there is no on-401 refresh-and-retry interceptor in `apiFetch` to recover. Pick one
TTL, read it from one place, and add a retry-once-on-401 path.

### 8. Email case handling is inconsistent → duplicate / unreachable accounts

`forgotPassword` and both OAuth paths lowercase the email. `register` and `login` do not, and there
is no `citext` column or `lower(email)` unique index.

Result: `Jane@Co.com` and `jane@co.com` are two separate accounts. A user who registers with mixed
case can never use forgot-password or Google sign-in against that account.

Fix: normalize at the edge (`.normalizeEmail()` in the validators) **and** add a
`CREATE UNIQUE INDEX ... ON users (lower(email))` migration after de-duping existing rows.

### 9. `/reset-password` has no rate limiter

Every other auth route has one. This one lets an attacker brute-force the 32-byte token — infeasible
in practice, but it's also a free unauthenticated DB-query amplifier. Add a limiter.

### 10. Password reset tokens stored in plaintext

`refresh_tokens` correctly stores SHA-256 hashes. `users.password_reset_token` stores the raw token,
so anyone with read access to a DB dump or a SQL-injection foothold elsewhere can take over any
account with a live reset in flight. Hash it the same way.

### 11. OTP rate limiters are keyed on a field the requests don't send

```js
keyGenerator: (req) => `${ipKey(req.ip)}:${req.body?.user_id || 'anon'}`
```

But `/verify-email` and `/resend-verification` send **`pending_id`**, not `user_id`. The key collapses
to `ip:anon` for every request. Two consequences:

- **Too loose:** per-account brute-force bounding is gone. The 6-digit OTP is live for 10 minutes and
  there is no per-pending attempt counter in the DB, so an attacker rotating IPs has a real shot.
- **Too strict:** everyone behind one NAT/corporate egress shares a single 6-attempt bucket.

Fix the key to `req.body?.user_id || req.body?.pending_id || 'anon'` and add an `attempt_count`
column on `pending_registrations` that invalidates the OTP after ~5 wrong guesses.

### 12. OAuth has no `state` parameter

Neither `/google` nor `/github` generates or verifies `state`. This is textbook login-CSRF: an
attacker can stitch their own provider account onto a victim's browser session. Generate a random
`state`, store it in a short-lived signed cookie, verify on callback.

### 13. OAuth passes the JWT and full user object in the URL query string

`redirectWithToken` puts `?token=<jwt>&user=<json>` in the redirect. That lands in browser history,
any `Referer` header the callback page emits, and every proxy/CDN access log in between. Set the
session cookie server-side and redirect clean, or hand back a one-time exchange code.

### 14. OAuth links to existing accounts by email with no verification

`findOrCreateOAuthUser` matches on email alone, has no provider/identity table, and — on the Google
path — never checks `profile.email_verified`. If an attacker controls an IdP account bearing a
victim's email address, they get the victim's Rachbase account. (The GitHub path is better: it does
require `primary && verified`.)

Also: `redirectWithError(res, err.message)` puts raw internal exception text into the user-facing URL.

### 15. Tokens in `localStorage`

`rd_access_token` / `rd_user` are readable by any XSS. The refresh token is correctly HttpOnly, which
makes this half-right — the access token should live in memory only.

---

## P2 — Correctness & hygiene

| # | Issue | Location |
|---|---|---|
| 16 | `refresh` doesn't `clearCookie` on the expired branch, so the client retries a dead cookie forever | `authController.js:424` |
| 17 | Refresh cookie is `sameSite: 'strict'` — it won't be sent on the cross-site top-level navigation back from an OAuth provider. `'lax'` is the correct setting here | `authController.js:75` |
| 18 | `/verify-email` declares express-validator rules but the controller never calls `validationResult` — it hand-rolls its own checks, so the declared validation is silently unenforced | `auth.js:42`, `authController.js:197` |
| 19 | OTP compared with `!==` rather than a constant-time compare | `authController.js:210` |
| 20 | `verifyPhone` issues a full session on a phone OTP alone, with no email-verified check | `authController.js:160` |
| 21 | `resendOtp` returns `404 User not found` → another enumeration oracle | `authController.js:185` |
| 22 | `pending_registrations` is never purged. The migration comment says "can be purged by a periodic job" — no such job exists. Bcrypt hashes of abandoned signups accumulate indefinitely | `016_*.sql` |
| 23 | Password minimum is 6 characters, no complexity or breach check, on both `/register` and `/reset-password` | `auth.js:34,106` |
| 24 | Two migrations numbered `022` (`022_agent_credits`, `022_nullable_tenant_in_orders`) — ordering is filesystem-dependent | `migrations/` |
| 25 | `NEXT_PUBLIC_API_URL` falls back to `localhost:3000`, which is the **frontend's** port; the backend is `8080` per `oauth.js`. Dev without the env var set silently points the app at itself | `api.ts:6`, `login/page.tsx:11`, `signup/page.tsx:5` |

---

## P3 — UX / structure of the path itself

This is the "clean up" part of the request.

- **Two signup entry points.** `/signup` is a stub that renders OAuth buttons and a *"Sign up with
  Email →"* link to `/login?tab=signup`. So an email signup costs an extra page load and the OAuth
  buttons are duplicated verbatim across both files. Either make `/signup` the real form or make it a
  `redirect()`.
- **Terms & Privacy only appear on the stub.** The actual signup form on `/login?tab=signup` has no
  terms notice or acceptance at all. That's the one that legally matters.
- **`login/page.tsx` is 529 lines** carrying login, signup, and the OTP screen in one component with
  ~20 `useState` calls. The OTP screen alone (timers, resend cooldown, attempts) is worth extracting —
  it's the most stateful and least tested part of the flow.
- **Resend cooldown is duplicated and can drift.** The frontend hardcodes `MAX_RESENDS = 5` and a 60s
  cooldown; the backend defines the same two constants independently. The backend already returns
  `resends_remaining` and `retry_after` — drive the UI off those.
- **No password strength meter** on a form that accepts 6-character passwords.
- **No `aria-live` on the error and OTP-error regions**, so screen readers don't announce failures.
- Login page ignores `?tab=` changes after mount (`initialTab` is only read once) — minor, but
  `switchTab` doesn't sync the URL either, so the signup tab isn't linkable/shareable except on first load.

---

## Suggested order of work

1. **#1** (`password_hash` column) — password reset, OAuth signup, and change-password are all dead until this is fixed.
2. **#2, #3, #4** — the whole OAuth path is non-functional end to end.
3. **#7** — silent 15-minute logouts are the most likely thing users are already complaining about.
4. **#11, #8** — rate-limiter key and email normalization; both are small diffs with real impact.
5. **#12, #13, #14** — OAuth hardening, best done in one pass with an `oauth_identities` table.
6. **#5/#6** — decide the enumeration-vs-UX tradeoff deliberately, then make backend and frontend agree.
7. P2/P3 cleanup.
