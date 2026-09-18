# RachBase Go-Live Audit #3 (Re-audit)

**Date:** 7 Sep 2026 (findings), updated same day after the F1–F7 fix wave · **Baselines:** 3 Sep full audit + 6 Sep re-audit (RACHBASE_GO_LIVE_AUDIT.md / _2.md) · **Target launch:** ~13 Sep (6 days)
**Method:** fresh snapshot (verified byte-identical to the last delivered fix wave — no drift); every prior finding re-verified against source with file:line evidence; an independent adversarial pass over all code written 6–7 Sep, including executed bypass probes; full test suites run. The audit found 7 numbered issues (F1–F7, plus F1b caught in consolidation review); **all were fixed the same day** — resolutions inline below.

---

## Verdict

**Engineering is done, pending your rehearsal.** The fix waves held under adversarial re-reading: 13 of 17 tracked items verified FIXED outright, and the 4 that showed cracks (plus the 7 new findings the fresh-eyes pass surfaced) were **all closed the same day** — re-verified by new tests. Current state: **305 tests green** (backend 229, billing 16, storage 4, auth 43, gateway 13), `next build` clean with standalone output. What now stands between you and the 13th is **entirely operations**: provider-console secret rotation (Razorpay key is still the pre-audit one), committing the tree (~280 files still uncommitted — no rollback point), Railway env + migrations 125–131, the tax-registration seed, one restore drill, one SLA number, and a dress rehearsal.

---

## Scorecard — all tracked findings (17 items, post-fix state)

| # | Finding (origin) | Verdict |
|---|---|---|
| 1 | Backups: project + control-plane, prune newest-keep guard, ops alerting, PGPASSWORD | 🟢 FIXED |
| 2 | Cross-tenant storage namespacing | 🟢 FIXED |
| 3 | GST end-to-end: gross-up, first-cycle + renewal invoices, fail-closed tax, billing-profile country guard | 🟢 FIXED |
| 4 | Payment amount/capture verification, no empty-key HMAC, GitHub webhook fails closed | 🟢 FIXED |
| 5 | Lifecycle: draft-delete gate, teardown, halt-suspend/resume, cancelled-is-terminal | 🟢 FIXED (F1/F1b/F7 closed the residual holes — see below) |
| 6 | Build: Suspense ×2, `output:"standalone"`, DATABASE_URL | 🟢 FIXED |
| 7 | DNS claimed_hosts registry + kind normalization (migs 128/131) | 🟢 FIXED |
| 8 | baas-auth redirect_to allowlist | 🟢 FIXED |
| 9 | Status API aggregation + single SLA page | 🟢 FIXED — SLA number decided **7 Sep: 99.95%**; Terms (`legal/terms`) and About (`about`) updated to match `/legal/sla` and the status page. Zero 99.9 stragglers remain in user-facing copy. |
| 10 | TRUST_PROXY + CORS credentials guard | 🟢 FIXED |
| 11 | req.ip everywhere, XFF copies consolidated | 🟢 FIXED |
| 12 | Webhook claim released on failure | 🟢 FIXED (F4 closed the swallowed-error exemption) |
| 13 | Tenant currency lock (mig 130) | 🟢 FIXED (F6 closed the webhook-activation gap) |
| 14 | Real Starter→Pro upgrade | 🟢 FIXED (F5/F7 closed the promotion + halted-base edges) |
| 15 | Storage upload cap, both mains | 🟢 FIXED |
| 16 | SSRF guard + GET/HEAD monitors | 🟢 FIXED (F3 closed the executed IPv6 bypass) |
| 17 | x-baas-role → verified internal JWT | 🟢 FIXED (F2 brought baas-functions into line) |

**Known-remaining by design** (tracked, post-launch): VM-postgres + SeaweedFS backups; in-process status prober (or external monitor); DNS-rebinding TOCTOU (documented in ssrfGuard).

---

## Audit #3 findings — all RESOLVED same day (fix + test noted per item)

**F1 · CRITICAL · Re-subscribe never resumed site workloads → RESOLVED.** Unsubscribe suspends the tenant on the site (replicas → 0), but no re-subscribe path ever enqueued the resume — the only caller was the webhook's `wasHalted` branch, which misses unsubscribe→re-subscribe (fresh `created` row), replaced halted rows, and the crash-after-`setStatus('active')` retry. A returning customer paid and stayed at 0 replicas forever. **Fix:** `tenant.resume` is now enqueued **unconditionally** on every paid base activation — in `/pro/verify` and in the webhook's charged-base branch (idempotent site-side; a routine renewal enqueues a cheap no-op). *Test:* cascade "EVERY paid base charge enqueues the site resume".

**F1b · HIGH · Verify-replay resurrected a cancelled base → RESOLVED.** (Caught reviewing the consolidation — it had been dropped between the agent reports and the numbered list.) The signature triple from the original checkout verifies forever, and `verifyProSubscription` had no status guard: replaying an old `/pro/verify` body flipped a **cancelled** row back to active and reopened the plan gate with no live mandate — a free plan, permanently, since no renewal would ever charge. **Fix:** `cancelled`/`halted` rows now 409 (`subscription_not_pending`); recovery is a real payment (webhook) or a fresh subscribe. `verifyContainer` was checked for the same class and is already safe (the `pending_order_id` binding blocks replays).

**F2 · HIGH · baas-functions trusted the spoofable `x-baas-role` header → RESOLVED.** The internal-JWT conversion had covered storage and auth but missed the highest-value primitive: a spoofed `service_role` header could deploy code, read stored source, and exfiltrate the project's entire secrets map (invoke injects it into the function env). **Fix:** `internalToken.js` copied in; role now derived via `roleFromRequest` from the gateway's verified HS256 token, identical to storage/auth. *Test:* interop suite covers the shared verifier.

**F3 · HIGH · SSRF guard bypass via hex-form v4-mapped IPv6 (executed) → RESOLVED.** WHATWG URL serializes `[::ffff:127.0.0.1]` as hex `::ffff:7f00:1`; the dotted-only regex missed it — loopback, cloud metadata (`::ffff:a9fe:a9fe`) and RFC1918 were reachable through the mapped range; NAT64 prefixes were unhandled. **Fix:** IPv6 is now expanded to 8 numeric groups and classified numerically — v4-mapped `::ffff:0:0/96` (hex or dotted) checks the embedded IPv4, `::/96` (unspecified/loopback/deprecated v4-compatible) and NAT64 `64:ff9b::/32` are blocked wholesale, link-local/ULA by prefix math, unparseable → fail closed. Bypass re-probed: blocked. *Tests:* 7 hex/NAT64/unabbreviated cases + end-to-end URL-serialization probes.

**F4 · HIGH · `fireSubscriptionEvent` swallowed errors, exempting the Pro lifecycle from webhook retry → RESOLVED.** A transient DB error mid-cascade (base cancel → stop → teardown) was logged, the webhook acked 200, the claim was kept — the event dropped permanently, defeating the claim-release mechanism for its biggest consumer. **Fix:** every listener still runs (fan-out preserved), but any failure now **propagates** afterwards, so the webhook releases its claim and Razorpay's retry reprocesses (handlers are idempotent per payment/subscription id). *Test:* hooks suite updated to assert the rejection + fan-out.

**F5 · MEDIUM · Allowance promotion selected non-active rows → RESOLVED.** Both the upgrade snapshot and the delete-promotion picked `created`/`halted`/`paused` and already-waived compute-only rows — an abandoned checkout could eat a freed slot while a paying container kept a fee it no longer owed. **Fix:** one shared predicate, `isFeePayingContainer` (active container whose recurring equals fee + compute), now drives both selectors; the loose `oldestContainer` SQL was deleted outright. *Test:* upgrade fixture with a ghost checkout + waived row + paying row — only the paying row promotes.

**F6 · MEDIUM · Webhook-activated base skipped the currency lock → RESOLVED.** When the browser never posts `/pro/verify` (the case the webhook backstops), `tenants.billing_currency` stayed NULL, reopening the address-edit currency-mix hole. **Fix:** the charged-base webhook branch now calls the idempotent `lockBillingCurrency` too. *Test:* cascade "webhook-activated base LOCKS the tenant billing currency".

**F7 · MEDIUM · Halted base + same-tier re-subscribe returned a dead checkout → RESOLVED.** A halted base fell into the resume branch and was handed back as a resumable checkout Razorpay can't authorize — the customer recovering from a failed payment dead-ended. **Fix:** a halted base is treated like a stale mismatched checkout: cancelled (deliberately ending Razorpay's dunning — an explicit re-subscribe is intent to pay fresh) and re-minted. The charged-webhook path still recovers a halt in place when the retried card succeeds on its own. *Test:* cascade "HALTED base is cancelled and re-minted".

**Lower severity — deliberately left open (week-1 acceptable):** ~~signed storage URLs~~ and ~~anon bucket listing~~ were closed in the backend feature sweep below; still open: tenant-controlled endpoint name/URL unescaped in admin alert emails; failed renewal-invoice issuance has no retry sweep; the combined baas-services container drops `redirectAllowList` config (fails closed).

---

## The remaining runway — all yours now

| When | What |
|---|---|
| ~~Day 1 (code)~~ | ~~F1–F7~~ **DONE** — 305 tests green. |
| ~~Decide~~ | ~~ONE SLA number~~ **DONE — 99.95% chosen 7 Sep; Terms + About edited to match.** Note what this commits you to: 99.95% allows ~22 min of downtime/month before credits (10% <99.95, 25% <99.9, 50% <99% per /legal/sla) — measuring it honestly still needs the external uptime monitor (the in-process prober can't see its own outages). |
| **Provider consoles** | Razorpay key/secret/webhook (still `rzp_live_SwM0…`), GitHub App key + webhook secret, Google/Brevo/GoDaddy/Grafana/Anthropic, DB password. Copy staged values (secrets/ROTATION-*.txt) + `TRUST_PROXY=1` into Railway for both backends, then **delete the txt + .env.bak files**. Deploy-key swap per runbook. |
| **Commit the tree** | ~280 files, four days of fixes, no rollback point. This is the single riskiest omission left. |
| **Prod env + data** | `OPS_ALERT_EMAIL`, `BACKUP_S3_*`, `BAAS_PG_ADMIN_URL`; migrations **125–131**; `scripts/setup-tax-registration.js`; external uptime monitor or ship 99.9%. |
| **Restore drill** | One BaaS project + control-plane rehearsal per RUNBOOK-restore.md. |
| **Dress rehearsal** | Real ₹ and $ end-to-end: subscribe → deploy → invoice → **Starter→Pro upgrade** → oversized upload (413) → private-IP monitor (rejected) → unsubscribe → workloads stop → **re-subscribe → workloads RESUME** (this exact path was F1) → cancelled-verify replay gets 409. |

## What's solid (verified, not just claimed)

The adversarial pass probed and confirmed clean: all decimal/octal/hex IPv4 SSRF encodings blocked (now including every IPv6 mapped form); concurrent double-subscribe blocked by partial unique indexes; invoice idempotency under verify/webhook overlap and retries; webhook signature checking (length-guarded, raw-body, constant-time); the gateway → primitives internal-token flow including anon public-bucket reads and OAuth/consent; upload cap unbypassable via absent/lying content-length; billing-profile gate on all three charge entry points; CORS credentials still flow for exact-listed origins; resize replay/crash windows converge; money math exact-paise with zero-rated RoW. **305 tests, 0 failures; build green.**

---

*Sequence of record: RACHBASE_GO_LIVE_AUDIT.md (3 Sep, 10 P0s) → _2.md (6 Sep, scorecard + 7-day plan) → this file (7 Sep, findings + same-day resolutions). Housekeeping: `_to_delete/` awaits deletion (incl. two stale git index.locks that were blocking git); `site-controller-1.0.2.tar.gz` and `_audit_snapshot2.tgz` in the repo root should stay out of git.*

---

## Addendum — Backend feature sweep (7 Sep, later): Realtime + Storage signed URLs

Prompted by the "are all Backend tabs working?" question. Two gaps stood out: **Realtime had never been audited** (the only primitive outside all three prior passes), and **Storage's signed URLs were broken end-to-end**. Both were audited, fixed, and covered by new tests the same day. All suites: **352 tests, 0 failures** (backend 234 · billing 16 · storage 6 · auth 43 · gateway 14 · baas 20 · rachbase-js 19).

### Realtime: dedicated audit → 10 findings → 8 fixed same day

The focused audit's headline: **the realtime WebSocket had never completed a handshake against the real server topology.** Two path-scoped WSS on one HTTP server break each other in ws@8 — every `/realtime/v1` upgrade was 400'd by the terminal's WSS, and the realtime WSS then corrupted the terminal's accepted sockets (reproduced empirically with the repo's own `ws`). Fixed and now proven by the feature's first integration tests (`tests/realtime_server.test.js`, real WebSockets over the same shared-upgrade-router topology `server.js` uses):

- **Wiring (#1, CRITICAL):** both WSS are `noServer`; `server.js` owns ONE `'upgrade'` router dispatching `/ws/terminal` and `/realtime/v1`; unknown paths get a clean 404.
- **Auth (#2, CRITICAL):** the server only accepted legacy HS256 JWTs — rejecting the ES256 session tokens auth actually mints and the opaque `rb_…` keys, leaving the no-expiry service god-key as the only working credential. Now: ES256 (project public key, issuer-bound) → opaque keys via control-plane introspection → HS256 legacy fallback.
- **Firehose (#3, HIGH, partial by design):** `table: '*'` subscriptions refused; `old` row values delivered only to `service_role`. The v1 model remains LISTEN/NOTIFY without per-row RLS — disclosed in code, dashboard, and here; WAL/CDC + RLS is the v2 path.
- **Limits (#4, HIGH):** 64 KB max payload (ws default was 100 MiB), total + per-project connection caps, per-connection subscription cap, presence key/state/count caps, bufferedAmount backpressure (drop at 1 MB, terminate at 4 MB), LISTEN-client cap — all env-tunable. This WSS rides the control-plane process; one noisy project can no longer take the dashboard down for every tenant.
- **LISTEN lifecycle (#5, MEDIUM):** ownership tracked per-connection (a Set, not a corruptible refcount), reconnect with backoff on PG errors (was: silent permanent death), and `subscribed` is no longer acked before LISTEN is actually established.
- **Presence (#6, MEDIUM):** keys are owned by the connection that tracked them (no hijack/expel of another client's entry), multi-key tracking cleans up ALL keys on disconnect (was: all-but-last leaked forever).
- **Expiry + lifecycle (#7, MEDIUM):** token expiry enforced for the connection's lifetime via the heartbeat sweep; `closeProject(ref)` exported for suspension/deletion; graceful shutdown closes sockets + LISTEN clients.
- **Trigger hardening (#9/#10, LOW):** the notify trigger now has an EXCEPTION guard so a pg_notify failure can never abort a customer's INSERT/UPDATE/DELETE; LIKE-pattern underscores escaped in trigger listing; >63-char trigger names get deterministic hash suffixes (no truncation collisions).

**Still open on Realtime (post-launch):** #8 — the SDK's default realtime URL points at the per-project gateway host, which doesn't proxy `/realtime/v1` yet (explicit `realtimeUrl` option documented in the SDK as the interim); per-row RLS filtering (v2); the dashboard's `presence: { key }` subscribe-config nicety. **Recommendation:** ship Realtime labeled beta, with the full-table-visibility disclosure it already carries.

### Storage signed URLs: from verify-only to a working feature

The feature existed only as a verifier — there was **no endpoint to mint a signed URL, and the gateway 401'd the credential-less GETs that are the feature's entire point** (`<img src>` can't send headers). Now: `POST /storage/v1/sign/:bucket/:key` mints (role-gated: must be able to read the bucket, never `anon` — the mint IS the sharing decision; TTL clamped 30 s–7 d), and the gateway passes **only** `GET /storage/v1/object/*` carrying both `sig` and `exp` through as `anon`, with the storage service doing the real constant-time HMAC + expiry check. Plus: bucket listing is now filtered to what the caller can read (`anon` no longer sees private bucket names). All covered by new storage + gateway tests, including the narrowness of the pass-through (no sig → 401, non-object path → 401, non-GET → 401).

### Backend-tab status after this sweep

API keys 🟢 · Table/SQL/Database 🟢 · Auth 🟢 · Functions 🟢 · **Storage 🟢 (signed URLs now work end-to-end)** · **Realtime 🟡 beta** (audited + 8 fixes + first integration tests; RLS-grade filtering and gateway proxying are v2) · Backups 🟢 code / ops-pending · Observability 🟢. The remaining honest gap between "code green" and "working" is unchanged: prod env, migrations, and the dress rehearsal.
