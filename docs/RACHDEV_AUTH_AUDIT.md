# RachDev — Auth Audit (applying the RachBase fixes)

Scope: `apps/rachdev-web/src/app/(auth)/*` and `apps/rachdev-backend`. Companion to `docs/AUTH_AUDIT.md` (the original RachBase audit).

## Key finding

Auth is **mostly shared code**. RachDev consumes `@rach/identity` (authController, oauth, user/refresh models), `@rach/core` (rateLimit, middleware, migrations) and `@rach/ui` (AuthContext, api client). Every RachBase fix that lives in those packages is **inherited by RachDev automatically**. The only place RachDev could still lag is its **own** `(auth)/*` pages — which is where the fixes below were applied.

## Inherited via shared packages — no RachDev change needed

Verified present in the shared packages RachDev already uses:

| Audit item | Where it's fixed |
|---|---|
| #1 `password_hash` column | `@rach/core` migration `027_auth_hardening.sql` |
| #7 access-token TTL + retry-once-on-401 | `@rach/ui` `api.ts` (`refreshAccessToken` + `_isRetry`) |
| #8 email normalization / `lower(email)` | `@rach/identity` + migration |
| #10 reset tokens hashed (SHA-256) | `@rach/identity` `authController.js` (`createHash('sha256')`) |
| #12 OAuth `state` (login-CSRF) | `@rach/identity` `oauth.js` |
| #13 no token/user in redirect URL | `@rach/identity` `oauth.js` (sets HttpOnly cookie, redirects with `?status`/`?error`) |
| #2 #3 #5 #6(backend) #9 #11 #14 #16–#24 | `@rach/identity` / `@rach/core` |

## Fixed in RachDev this pass (app-level)

- **auth-callback (P0 — #4/#13/#15).** RachDev's page still read `?token=&user=` from the URL and called `login(token, user)` with the wrong signature — but the shared OAuth backend was changed to set an HttpOnly cookie and redirect with `?status`/`?error` (no token in URL). So **OAuth sign-in was broken in RachDev**. Replaced with the fixed flow: `hydrateFromCookie()`, friendly `?error` messages, a StrictMode double-invoke guard (avoids refresh-token reuse detection), and an error UI. Tokens are no longer written to `localStorage` here.
- **#25 API URL fallback.** `login/page.tsx` and `signup/page.tsx` had `BACKEND_URL = … || 'http://localhost:3000'` (the frontend's own port), so OAuth links pointed at the app itself when the env var was unset. Changed the fallback to `:8080`, matching the shared api client.
- **Terms acceptance (legal).** The real signup form (`/login?tab=signup`) had no Terms/Privacy acceptance — it only appeared on the `/signup` stub, i.e. not on the form people submit. Added a required Terms-of-Service / Privacy-Policy checkbox that gates the submit.
- **Password strength (P3).** Added the shared `PasswordStrength` meter + `isPasswordValid` gate (`@rach/ui/components/auth/PasswordStrength`) to the signup form.
- **Accessibility (P3).** Added `role="alert"` + `aria-live` to the sign-in error, the "no account" card, the signup error, and the OTP-error regions so screen readers announce failures.

## Not an issue in RachDev

- **#6 pending_id / unverified flow.** RachDev's login already handles `e2.pending_id` (jumps to the OTP screen). No change.

## Deferred (P3 structural — optional, not a correctness/security fix)

- **Two signup entry points.** `/signup` is still a stub linking into `/login?tab=signup`. Structural tidy-up, not a fix.

### TODO — port the OTP-screen refactor to RachDev  *(follow-up)*

RachBase replaced its inline OTP state machine with the **shared** `OtpVerification` component; RachDev's `login/page.tsx` still hand-rolls the OTP screen (boxes, timers, resend cooldown, attempts — ~150 lines and most of the page's `useState` calls). Porting it is low-risk because the component already exists and is shared.

What to do:
1. Import the shared component: `import { OtpVerification } from '@rach/ui/components/auth/OtpVerification';`
2. Replace RachDev's OTP-related state with a single `pending` object: `{ pendingId, email, expiresAt, resendsRemaining }` (drive `resendsRemaining` off the backend's `resends_remaining` instead of the hardcoded frontend `MAX_RESENDS`, which can drift).
3. On successful register / `pending_id` login, `setPending({...})`; render `<OtpVerification ... onVerified={handleVerified} onBack={...} />` when `pending` is set (see `apps/rachbase-web/src/app/(auth)/login/page.tsx` ~L138–150 for the exact shape).
4. Delete the now-dead inline OTP markup + handlers (`handleOtpChange`, resend timers, otp state, etc.).

Reference: `apps/rachbase-web/src/app/(auth)/login/page.tsx`. Effort: ~1 focused pass; net line reduction. Purely a maintainability/consistency win — behaviour is already correct in RachDev.

## Verification

- `rachdev-web` typecheck: **0 real errors** (only the app-wide `@rach/ui` subpath-resolution noise under raw tsc, cleared by `next build`).
- **RachBase left untouched** (git clean vs HEAD); all changes are in `apps/rachdev-web/src/app/(auth)/*`.
