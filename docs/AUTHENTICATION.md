# Authentication — Sign Up & Sign In

How accounts are created, verified, and signed in across Rachbase.

RachBase is the **identity provider**: it issues tokens. RachDev validates them.
Both apps mount the same routers from `@rach/identity`.

- **Backend:** `packages/identity` — routes, controllers, models, jobs
- **Shared middleware:** `packages/core` — rate limiting, db pool, mailer, SMS
- **Frontend:** `packages/ui` (AuthContext, API client, auth components) +
  `apps/rachbase-web/src/app/(auth)/*`
- **Schema:** `packages/core/src/db/migrations`

---

## 1. Feature summary

| Feature | Status | Notes |
|---|---|---|
| Email + password signup | ✅ | Two-phase: pending row → OTP → real user |
| Email OTP verification | ✅ | 6 digits, 10 min TTL, 5 wrong guesses, 5 resends |
| Email + password login | ✅ | Argon-free; bcrypt cost 12 |
| Google OAuth | ✅ | `state` CSRF, verified-email required |
| GitHub OAuth | ✅ | Primary **verified** address only |
| Password reset by email | ✅ | 30 min TTL, single use, hashed at rest |
| Change password (signed in) | ✅ | Revokes all other sessions |
| Refresh tokens w/ rotation | ✅ | Family-based reuse detection |
| Silent token refresh | ✅ | Client refreshes at 75% of token lifetime |
| Logout / logout-all | ✅ | Per-session and per-user revocation |
| Phone OTP verification | ⚠️ Partial | Endpoints exist; email is the primary path |
| MFA / TOTP | ❌ | Not implemented |
| Magic links | ❌ | Not implemented |
| SSO / SAML | ❌ | Not implemented |

---

## 2. Roles and account model

Roles live in the `user_role` enum: `admin`, `tenant_admin`, `tenant_user`, `developer`
(`customer` is the legacy name for `tenant_user`; see migration 007).

**Self-registration is limited to `tenant_user` and `developer`.** `admin` and
`tenant_admin` are rejected at the API — they're assigned by an existing admin
or the bootstrap script.

Key `users` columns:

| Column | Meaning |
|---|---|
| `password_hash` | bcrypt hash. **Nullable** — OAuth-only accounts have none |
| `email_verified` | Proven ownership of the address |
| `phone_verified` | Login gates on this; set automatically when there's no phone |
| `tenant_id` | Null for system admins and un-assigned users |

> **Naming note.** Until migration 027 this column was `password`, while three
> code paths wrote to `password_hash`. Password reset, OAuth signup, and
> change-password all threw `42703 undefined_column` in production. 027 renames
> the column and makes it nullable.

---

## 3. Sign-up flow (email + password)

The defining property: **no `users` row exists until the OTP is confirmed.**
Unverified signups sit in `pending_registrations` and never pollute the user
table.

```
┌──────────┐   POST /api/auth/register    ┌────────────────────────┐
│  Client  │ ───────────────────────────► │ pending_registrations  │
└──────────┘                              │  (name, email, hash,   │
     │                                    │   otp_token, expiry)   │
     │        { pending_id, expires_at }  └────────────────────────┘
     │ ◄──────────────────────────────────────────┘   │
     │                                                │ Brevo
     │                                                ▼
     │                                        ✉ 6-digit code
     │
     │  POST /api/auth/verify-email { pending_id, code }
     ├──────────────────────────────────────────────────►
     │                                    ┌─────────────────────────┐
     │                                    │ 1. check expiry         │
     │                                    │ 2. check attempt_count  │
     │                                    │ 3. constant-time compare│
     │                                    │ 4. re-check conflicts   │
     │                                    │ 5. INSERT users         │
     │                                    │ 6. DELETE pending row   │
     │                                    └─────────────────────────┘
     │ ◄── { access_token, expires_in, user } + refresh cookie
     ▼
  /dashboard
```

### Step detail

**1. `POST /api/auth/register`** — rate limited to 5/hour/IP.

Validates name, email (normalized to lowercase), password (≥10 chars, letter +
number/symbol), optional phone (parsed to E.164 via `libphonenumber-js`).
Rejects `admin`/`tenant_admin` roles.

Checks for an existing verified user by email *and* phone, hashes the password
(bcrypt cost 12), then **upserts** into `pending_registrations` keyed on email —
so retrying a signup refreshes the OTP rather than erroring.

Returns `201 { message, email_sent, pending_id, expires_at }`.

> `email_sent: false` means the record exists but Brevo failed. The user can
> still resend. The registration is *not* rolled back.

**2. `POST /api/auth/verify-email`** — rate limited to 6/10 min per
IP+`pending_id`.

Ordering matters:

1. **Expiry first** — an expired code reports as expired and doesn't burn an attempt.
2. **Attempt ceiling** — 5 wrong guesses locks the code (`429`, `locked: true`).
   This is the real brute-force bound; the IP limiter only caps request volume.
3. **Constant-time compare** of the OTP.
4. **Re-check email/phone conflicts** — someone else may have registered the
   same address during the 10-minute window.
5. Create the user, mark email + phone verified, delete the pending row, issue tokens.

**3. `POST /api/auth/resend-verification`** — 3/10 min per IP+`pending_id`.

- Max **5** resends per registration
- **60-second** cooldown between resends
- Resets `attempt_count` to 0 and issues a fresh code

Returns `resends_remaining` and `expires_at`; the UI is driven entirely by these
rather than by client-side constants.

---

## 4. Sign-in flow (email + password)

```
POST /api/auth/login  { email, password }
        │
        ▼
  User.findByEmail(lower(email))
        │
        ├── bcrypt.compare ALWAYS runs (dummy hash if no user) → uniform timing
        │
        ├─ no user, pending registration exists
        │     └─► 403 { pending_id, expires_at, resends_remaining }
        │            → client resumes at the OTP screen
        │
        ├─ no user, no pending
        │     └─► 404 { no_account: true }   ← see § Account enumeration
        │
        ├─ wrong password  ─► 401 Invalid credentials
        ├─ no password_hash (OAuth-only) ─► 401 Invalid credentials
        ├─ !phone_verified ─► 403 { user_id }  (sends SMS OTP if a phone exists)
        │
        └─ success ─► 200 { access_token, expires_in, user } + refresh cookie
```

Rate limited to **5 attempts / 15 min**, keyed on `IP + email` so an attacker
can't lock a victim out by hammering their address from elsewhere.

---

## 5. OAuth flow (Google & GitHub)

```
 Browser              Backend                    Provider
    │  GET /api/auth/google │                        │
    ├──────────────────────►│                        │
    │                       │ INSERT oauth_states    │
    │  302 → provider (state=…)                      │
    ├───────────────────────────────────────────────►│
    │                       │                consent screen
    │  302 → /api/auth/google/callback?code=…&state=…│
    │◄───────────────────────────────────────────────┤
    ├──────────────────────►│                        │
    │                       │ DELETE…RETURNING state │  ← single use
    │                       │ POST /token ───────────►│
    │                       │ GET  /userinfo ────────►│
    │                       │                        │
    │                       │ resolveOAuthUser()     │
    │                       │ issueTokens() → cookie │
    │  302 → /auth-callback?status=ok   (no token!)  │
    │◄──────────────────────┤                        │
    │  POST /api/auth/refresh (sends cookie)         │
    ├──────────────────────►│                        │
    │◄── { access_token, expires_in, user }          │
    ▼
 /dashboard
```

### Identity resolution — precedence

`resolveOAuthUser()` never trusts an email address on its own:

1. **`oauth_identities` match** on `(provider, provider_user_id)`. The provider's
   subject id is the only stable identifier — emails change hands.
2. **Existing local user with the same email** — permitted *only* when the
   provider asserts the email is verified **and** the local account is already
   `email_verified`. Otherwise `unverified` is returned and the user must verify
   through the normal flow first.
3. **Otherwise create a new user** with `password_hash = NULL`, `email_verified = true`,
   and a linked `oauth_identities` row.

Google's `email_verified` claim is checked (it accepts both boolean `true` and
string `"true"`). GitHub resolves the **primary verified** address from
`/user/emails` rather than the public `profile.email`, which is unverified.

### Setting a password on an OAuth account

OAuth-only accounts have no password. `POST /api/users/me/password` detects
this and directs the user to **Forgot password**, which sets one for the first
time. Password login for such an account returns `401` until then.

---

## 6. Password reset

```
POST /api/auth/forgot-password { email }     — 5/hour/IP
   → always 200, same message, whether or not the account exists
   → if user exists AND email_verified:
        token = 32 random bytes
        store SHA-256(token) + 30 min expiry
        email the plaintext token as ?token= in the reset URL

POST /api/auth/reset-password { token, password }   — 10/hour/IP
   → look up by SHA-256(token) with expiry > NOW()
   → bcrypt the new password
   → NULL out the reset columns
   → RefreshToken.revokeAll(user) — every existing session dies
```

Only the **hash** is persisted, matching how refresh tokens are stored. The
plaintext exists solely inside the email. Migration 027 nulls any tokens issued
under the old plaintext scheme — links in flight at deploy time stop working,
which is the intended outcome.

---

## 7. Token model

| | Access token | Refresh token |
|---|---|---|
| Format | JWT (HS256) | 40 random bytes, opaque |
| Lifetime | `JWT_ACCESS_EXPIRES_IN`, default **30m** | `JWT_REFRESH_EXPIRES_IN`, default **30d** |
| Storage (client) | `localStorage` + React state | **HttpOnly cookie**, JS cannot read |
| Storage (server) | Stateless | SHA-256 hash in `refresh_tokens` |
| Transport | `Authorization: Bearer …` | Cookie, `path=/api/auth` |
| Claims | `id`, `email`, `role`, `tenant_id` | — |

Cookie flags: `httpOnly`, `sameSite=lax`, `secure` in production, scoped to
`/api/auth`.

> `sameSite` must be **lax**, not strict. The OAuth provider returns the user
> via a cross-site top-level navigation, and `strict` withholds the cookie on
> exactly that request — which is what broke the OAuth return trip.

### Rotation and reuse detection

Every refresh **rotates**: the presented token is revoked and a new one issued
within the same `family_id`.

If an already-revoked token is presented, that means someone replayed a stolen
token — the entire family is revoked and the session is terminated. The client
receives `401 Refresh token reuse detected`.

Every failing refresh path clears the cookie, so a browser holding a dead token
stops replaying it.

### Client-side refresh

Two mechanisms in `packages/ui`:

1. **Proactive** — `AuthContext` refreshes on a timer at **75% of the token's
   actual lifetime**, read from the server's `expires_in`.
2. **Reactive** — `apiFetch` catches the first `401` on any token-authenticated
   request, refreshes once, and replays the original request.

Both funnel through a **single shared in-flight promise**. This is load-bearing:
because refresh tokens rotate and replay trips the reuse detector, six
concurrent refreshes from a dashboard mount would revoke the family and log the
user out — the precise failure rotation exists to catch.

> Historically this was a fixed 7-hour interval that assumed an 8-hour token,
> while the server issued 15-minute tokens. Sessions died 15 minutes in with
> nothing scheduled to renew them.

---

## 8. Endpoint reference

| Method | Path | Auth | Rate limit | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | 5/hr/IP | Start signup → `pending_id` |
| POST | `/api/auth/verify-email` | — | 6/10min | Confirm OTP → create user + session |
| POST | `/api/auth/resend-verification` | — | 3/10min | New OTP (max 5, 60s cooldown) |
| POST | `/api/auth/login` | — | 5/15min | Password login |
| POST | `/api/auth/refresh` | cookie | 30/15min | Rotate → new access token + user |
| POST | `/api/auth/logout` | Bearer | — | Revoke current session |
| POST | `/api/auth/logout-all` | Bearer | — | Revoke every session |
| POST | `/api/auth/forgot-password` | — | 5/hr/IP | Email a reset link |
| POST | `/api/auth/reset-password` | — | 10/hr/IP | Consume token, set password |
| POST | `/api/auth/verify-phone` | — | 6/10min | Phone OTP → session |
| POST | `/api/auth/resend-otp` | — | 3/10min | Resend phone OTP |
| GET | `/api/auth/google` | — | 20/15min | Start Google handshake |
| GET | `/api/auth/google/callback` | — | — | Complete → cookie + redirect |
| GET | `/api/auth/github` | — | 20/15min | Start GitHub handshake |
| GET | `/api/auth/github/callback` | — | — | Complete → cookie + redirect |
| POST | `/api/users/me/password` | Bearer | — | Change password (revokes sessions) |

OTP limiters key on `IP + (user_id ?? pending_id)`. The phone flow sends
`user_id`; the email flow sends `pending_id` — reading only one of them
collapsed every request to `<ip>:anon`.

---

## 9. Frontend routes and components

| Route | File | Purpose |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Sign-in **and** sign-up (tabbed, `?tab=signup`) |
| `/signup` | `(auth)/signup/page.tsx` | Server redirect → `/login?tab=signup` |
| `/forgot-password` | `(auth)/forgot-password/page.tsx` | Request a reset link |
| `/reset-password` | `(auth)/reset-password/page.tsx` | Consume `?token=` |
| `/auth-callback` | `(auth)/auth-callback/page.tsx` | OAuth landing; hydrates from cookie |

Shared components in `packages/ui/src/components/auth/`:

- **`OAuthButtons.tsx`** — provider buttons + divider
- **`OtpVerification.tsx`** — the 6-box OTP screen, timers, resend logic
- **`PasswordStrength.tsx`** — meter + rule checklist, and `isPasswordValid()`

`PASSWORD_RULES` in `PasswordStrength.tsx` mirrors the server validator in
`packages/identity/src/routes/auth.js`. **The server is authoritative** — if you
change one, change both.

### State ownership

`AuthContext` (`packages/ui/src/contexts/AuthContext.tsx`) exposes:

| | |
|---|---|
| `login(email, password)` | Password sign-in, then routes to `/dashboard` |
| `register(name, email, password, phone?)` | Returns `{ pending_id, expires_at }` — **no session yet** |
| `setSession(token, user, expiresIn?)` | Adopt a session (used after OTP verify) |
| `hydrateFromCookie()` | Trade the refresh cookie for a session (OAuth return) |
| `logout()` | Revoke server-side, clear local, route to `/` |

> `login` takes **email and password**. The OAuth callback must use
> `hydrateFromCookie()` or `setSession()` — it previously called
> `login(token, user)`, firing a real login request with the JWT as the email.

---

## 10. Security controls

**Implemented**

- bcrypt cost 12; uniform login timing via a dummy hash comparison
- Refresh tokens hashed (SHA-256) at rest; rotation + family reuse detection
- Reset tokens hashed at rest, single use, 30 min
- OTPs generated with `crypto.randomInt`, compared in constant time
- OAuth `state`, single-use and 10-minute TTL
- OAuth credentials never travel in a URL
- Case-insensitive email uniqueness (`lower(email)` unique index)
- Rate limits on every auth endpoint
- Password reset and change both revoke all sessions
- Hourly cleanup of pending registrations, expired OAuth state, dead tokens

**Known gaps**

| Gap | Impact | Notes |
|---|---|---|
| Access token in `localStorage` | XSS can exfiltrate a ≤30 min token | Refresh token is HttpOnly, which caps the blast radius. In-memory storage is the fix |
| No MFA | — | Not implemented |
| No breach-corpus password check | Weak-but-compliant passwords accepted | Consider HIBP k-anonymity |
| Login reveals whether an email exists | Enumeration | Deliberate — see below |
| Migrations `022_agent_credits` / `022_nullable_tenant_in_orders` share a number | Ordering is filesystem-dependent | Not renamed: the runner tracks applied migrations *by filename*, so renaming would re-run them on deployed databases |

### Account enumeration — a deliberate tradeoff

`POST /api/auth/login` returns **404 `no_account: true`** for an unknown email
and **401** for a wrong password. That difference tells an attacker which
addresses are registered.

This is a **product decision**, kept so the UI can show the "No account found —
create one?" prompt. Note it partly defeats the `DUMMY_BCRYPT_HASH` timing
defence in the same function, which exists to hide precisely this fact.

To close it: return the same `401 Invalid email or password` from both branches
in `authController.login`, and drop the amber card in
`(auth)/login/page.tsx`. The pending-registration branch (403 + `pending_id`)
would need the same treatment.

---

## 11. Configuration

| Variable | Default | Notes |
|---|---|---|
| `JWT_ACCESS_SECRET` | — | **Required.** Signing key |
| `JWT_ACCESS_EXPIRES_IN` | `30m` | Single source of truth; server reports it as `expires_in` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Parsed with `ms` |
| `BCRYPT_COST` | `12` | |
| `APP_URL` | `http://localhost:3000` | Frontend origin; OAuth + reset links |
| `BACKEND_URL` | `http://localhost:8080` | Used to build OAuth redirect URIs |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080` | Frontend → API base |
| `GOOGLE_CLIENT_ID` / `_SECRET` | — | Redirect URI: `{BACKEND_URL}/api/auth/google/callback` |
| `GITHUB_CLIENT_ID` / `_SECRET` | — | Redirect URI: `{BACKEND_URL}/api/auth/github/callback` |
| `NODE_ENV` | — | `production` sets `secure` on the refresh cookie |

> `NEXT_PUBLIC_API_URL` previously defaulted to `localhost:3000` — the Next dev
> server's own port — so an unset variable pointed the app at itself.

---

## 12. Background jobs

`packages/identity/src/jobs/authCleanup.js`, started from
`apps/rachbase-backend/src/app.js` (skipped when `NODE_ENV=test`). Runs hourly:

- `pending_registrations` older than 24h — abandoned signups, each holding a bcrypt hash
- `oauth_states` past expiry
- `refresh_tokens` more than 30 days past expiry
- Expired `password_reset_token` values

Also runnable as a one-shot:

```bash
node -e "require('@rach/identity').runAuthCleanup().then(()=>process.exit(0))"
```

---

## 13. Relevant migrations

| # | What |
|---|---|
| 001 | `users`, `verification_codes`, `refresh_tokens` |
| 007 | `tenant_admin` / `tenant_user` roles |
| 009 | Phone becomes optional |
| 014 | `email_verified` |
| 016 | `pending_registrations` |
| 017 | `resend_count`, `last_resent_at` |
| 019 | Password reset columns |
| **027** | **Auth hardening** — see below |

**027 (`027_auth_hardening.sql`)**

1. `users.password` → `users.password_hash`, made nullable for OAuth accounts
2. Unique index on `lower(email)` — **aborts with a clear error if
   case-duplicate emails already exist**; merge them first
3. `pending_registrations.attempt_count`
4. `oauth_identities` table
5. `oauth_states` table
6. Nulls all existing plaintext reset tokens

---

## 14. Testing the flows manually

```bash
# 1. Register
curl -sX POST localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","password":"correct-horse-9"}'
# → { pending_id, expires_at }

# 2. Verify (OTP from the email, or read otp_token from the DB in dev)
curl -sX POST localhost:8080/api/auth/verify-email \
  -H 'Content-Type: application/json' \
  -d '{"pending_id":1,"code":"123456"}' -c cookies.txt
# → { access_token, expires_in, user }

# 3. Refresh using the cookie
curl -sX POST localhost:8080/api/auth/refresh -b cookies.txt -c cookies.txt

# 4. Log in
curl -sX POST localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"correct-horse-9"}'
```

OAuth needs a real browser — the handshake depends on cookies and redirects.
