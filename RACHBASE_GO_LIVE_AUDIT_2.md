# RachBase Go-Live Audit #2 (Re-audit)

**Date:** 6 Sep 2026 · **Baseline:** Sep 3 audit (RACHBASE_GO_LIVE_AUDIT.md) · **Target launch:** ~13 Sep (7 days)
**Method:** fresh snapshot of the working tree; every Sep 3 finding re-verified with file:line evidence; all code written since Sep 3 (backups, GST, teardown, namespacing, host registry, redirect allowlist, payment hardening) independently reviewed for new bugs; full test suites executed.

---

## Verdict

**Big three days.** Of the 10 P0 blockers, 5 are properly fixed, 3 are substantially fixed with real gaps remaining, and 2 are untouched — and the fixes are largely well-built (payment hardening, teardown, and host registry are done right; all 171 runnable tests pass: billing 16, backend 155, storage 3). The re-audit of the new code found **no criticals, 2 highs, 6 mediums** — a good ratio for three days of fast work.

**What still blocks launch:** the three build/deploy blockers are untouched (the app still doesn't `next build` or produce a Docker image — these are hours of work, do them first); the live secrets on disk are byte-identical to Sep 3, so **no rotation happened**; the control-plane database still has zero backups (the new backup system covers customer BaaS DBs only); Pro subscription **renewals** still produce no GST invoice; and the two worst new bugs are in the fix code itself (backup pruning can delete the last good backup during a silent failure streak; a replayed `charged` webhook resurrects a cancelled subscription). All of this fits in 7 days. A revised plan is at the end.

---

## Scorecard — Sep 3 P0 blockers

| # | Sep 3 blocker | Status | Notes |
|---|---|---|---|
| 1a | Backups — customer BaaS DBs | 🟡 **PARTIAL** | Real system now: daily `pg_dump -Fc` per project → S3, tiered retention, restore-to-new-DB, endpoints, tests, started in server.js. See new findings N1–N4. |
| 1b | Backups — control-plane DB, VM Postgres, SeaweedFS | 🔴 **OPEN** | Zero automation for the tenants/billing/subscriptions DB — the one that can't be re-derived. No restore runbook. |
| 1c | DB images on container path (no PVC) | 🟢 **FIXED** | `lib/statefulImage.js` guardrail enforced at create + checkout. Right call for launch. |
| 2 | Cross-tenant object storage | 🟢 **FIXED** | `/buckets/<ref>/<bucket>/<key>`; ref from control-plane-set env, not spoofable; traversal-safe; signed URLs covered; migration script exists (see N7). |
| 3 | GST never charged | 🟡 **PARTIAL** | Charging is now correct end-to-end (gross-up once, exact paise, USD zero-rated, display matches charge). But **renewals are never invoiced** (N5) and a tax-engine failure silently creates an ex-GST recurring plan forever. |
| 4 | Payment amount bypass | 🟢 **FIXED** | `assertOrderPaid` captured-amount checks in both expansion verifies; unique order-id index + ON CONFLICT; `containerBilling` delegates to paymentSecurity (throws on missing secret); GitHub webhook fails closed. |
| 5 | Draft-delete promotion leak | 🟢 **FIXED** | Promotion gated on `!row && shared && status==='online'`. |
| 6 | Teardown on cancel/delete | 🟢 **FIXED** (one gap → N6) | `siteTeardown.js` enqueues correct outbox ops on terminal webhooks, unsubscribe, and deleteTenant; deleteTenant now cancels Razorpay subs. Data never destroyed on transient failure — correct. |
| 7 | Build blockers (Suspense ×2, standalone vs Dockerfile, DATABASE_URL) | 🔴 **OPEN** | All three byte-identical to Sep 3. The app cannot build for production today. |
| 8 | DNS/subdomain takeover | 🟢 **FIXED** | Migration 128: global `claimed_hosts` + backfill of all 3 namespaces; claim-before-DNS everywhere. Cosmetic bug: runtime uses kind `'vm_custom'`, backfill used `'custom'` → owners re-adding their own pre-existing custom domain get a 409. |
| 9 | Secrets: rotation + hygiene | 🟡 **PARTIAL** | Hygiene fixed (.gitignore covers secrets/, PII file deleted, validateEnv rejects `change_me*` and <16-char secrets, compose now fails fast). **But `.env` still holds the identical `rzp_live_SwM0…` key and service token — nothing was rotated.** |
| 10 | SLA machinery | 🟡 **PARTIAL** | One SLA page now (`/legal/sla`, 99.95%); `/api/status` fixed with SQL aggregation + 30s cache. Prober still runs in-process against the same DB — outages still record as 100% uptime. Terms + About pages still say "99.9%" vs the SLA's 99.95%. |

## Scorecard — key Sep 3 P1s

Fixed: env placeholder validation, readiness probes on project pods (tcpSocket; no liveness probe yet).
Still **OPEN**, unchanged: trust proxy (login lockout DoS + 5 signups/hour platform-wide behind Railway), Starter→Pro upgrade no-op with fake success screen, service-page USD hardcodes for India customers, checkout `currency="USD"` fallback, billing-page order modal ₹ default, credit-purchase error swallow + missing script `onerror`, SSRF endpoint monitors (still PUT/DELETE to any URL), storage upload size limit unenforced, webhook dedupe-before-process, operator alerting (nothing), `x-baas-role` header trust, CORS reflect+credentials, broken logo + empty illustrations dir + missing arka logo, currency lock per tenant, `unhandledRejection` (now routed through graceful shutdown — better — but still exits 0, so on-failure supervisors won't restart).

---

## New findings — bugs in the fix code

**N1 · HIGH — Backup pruning can delete the only good backup.** `pruneExpired` (`backupService.js:159-178`) is purely age-based with no "always keep the newest completed" guard. If dumps start failing silently (see N3), after the retention window the last good backup is deleted and the project has zero restorable backups. Fix: never prune a project's newest completed backup; refuse to prune when there's nothing newer.

**N2 · HIGH — Pro renewals still produce no GST invoice.** `paymentController.js:162-238` only invoices rows found in the legacy `subscriptions` table; `pro_subscriptions` charges match nothing, and `proSubscription.handleWebhook`'s `charged` branch receives `paymentId`/`amountMinor` and ignores them. Only cycle 1 (at verify) and resize deltas are invoiced. Every INR renewal from month 2 on is a statutory invoice gap — the core of Sep 3's P0 #3, half-closed. Fix: issue the invoice from the `charged` branch, keyed on paymentId (the invoice engine is already idempotent per payment).

**N3 · MEDIUM — Backup failures are completely silent.** Every failure path is `console.error` only; a rotated S3 credential means weeks of zero backups with no signal (compounds N1). Wire the existing `alerting.js` to N-consecutive-failures; surface last-success age.

**N4 · MEDIUM — BaaS-cluster admin password on the pg_dump/pg_restore command line.** `backupService.js:51-55,90,140` passes the full admin URL as an argument — visible in `/proc/<pid>/cmdline` for the duration of every dump. Pass via `PGPASSWORD` env instead. (Everything else in the backup code is clean: strict ref validation, no shell, restore never in-place.)

**N5 · MEDIUM — Replayed `charged` webhook resurrects a cancelled subscription.** `proSubscription.js:341-356` has no terminal-state guard: a `charged` event delivered (or retried by Razorpay, up to days later) after unsubscribe/deleteTenant flips the row back to `active`, restores `tenants.plan` (even on a soft-deleted tenant), and marks services online with no mandate behind them. Fix: treat `cancelled` as terminal.

**N6 · MEDIUM — `halted` (card failing, retrying) never stops the actual workload.** Base halt flips DB statuses and the plan, but enqueues no site op — containers keep serving traffic unbilled, and the halted state also drops them out of the drift sweep (`siteStatusWorker.js:144` scans only online/deploying). `siteTeardown.js`'s own header comment explains why DB-only flips don't stop anything. Fix: enqueue reversible `tenant.suspend WORKLOADS_STOPPED` on base halt (resume on `charged` — but fix N5 first, in that order).

**N7 · MEDIUM — Checkout collects a billing address it never saves.** The checkout tax preview uses the typed address, but `handleSubscribe` never persists it — the server's gross-up and invoice read `users.billing_address`/`gstin` from the profile. A new Indian user with no saved profile address is previewed ₹+GST but charged ex-GST in USD terms of region resolution too. Fix: PATCH the profile before creating the subscription.

**N8 · LOW (several).** Storage migration script re-uploads every object as `application/octet-stream` (headers never captured) and mishandles `#`/`%` in keys — fix before running it, since it rewrites customer objects. `verifyExpansionPayment` doesn't require `is_active` on the package. `deleteTenant` cancels only `status='active'` legacy subs — halted ones can resume charging a deleted tenant. `countBillableShared` counts stopped/crashed services toward the allowance (quotes the paid rate while running nothing). Backup worker has no cross-instance advisory lock (keyRotation has the pattern). `RACHBASE_APP_SUBDOMAIN` set → claimed host and created A record diverge. Stale "$15/$30" comments persist in proSubscription/siteController.

---

## Revised 7-day plan

| Days | Work |
|---|---|
| **1 (do first — hours, not days)** | The three build blockers: Suspense wraps on billing + deployment pages; re-add `output:"standalone"` (railway.json is DOCKERFILE); `DATABASE_URL` support in db.js. **Rotate the Razorpay secret, JWT secrets, deploy SSH key, GitHub App key** — a runbook (RUNBOOK-secret-rotation.md) already exists in the repo, execute it. Commit the working tree — everything is still uncommitted, there's no rollback point. |
| **2** | Money completeness: renewal invoices from the `charged` branch (N2); terminal-state guard (N5); checkout address persistence (N7); make proTax failure fail the checkout rather than silently create an ex-GST plan. |
| **3** | Backups to done: control-plane DB into the same backup system (or Railway backups + verified restore); newest-backup prune guard (N1); failure alerting (N3); PGPASSWORD (N4); write RUNBOOK-restore and rehearse one BaaS-project restore end-to-end. |
| **4** | Halt suspend op (N6); `trust proxy`; webhook process-then-dedupe; upload size cap; fix + run the storage migration script (N8) if any pre-namespacing objects exist. |
| **5** | Frontend money paths: service-page INR pricing, checkout currency fallback, order-modal default, credit-purchase error surfacing + script onerror, Starter→Pro upgrade (or hide the upgrade CTA for launch). Assets: logo, illustrations, arka logo. Align Terms/About with the SLA number — and decide it: with the prober still in-process, **99.95% remains unmeasurable; either externalize probing (a $5 VPS or UptimeRobot, ~half a day) or publish 99.9%.** |
| **6** | Operator alerting (Slack webhook on dead-letters + probe failures + backup failures); SSRF restriction (GET/HEAD + private-IP block); pool error handlers + SIGTERM in baas-* services; CORS credentials guard; exit-code-1 on crash shutdown. |
| **7** | Dress rehearsal: clean build → staging → real ₹ and $ payments end-to-end (subscribe → deploy → invoice check → cancel → verify workloads actually stop) → restore drill → funnel smoke test. |

Can slip to week 1 post-launch if needed: x-baas-role JWT verification, liveness probes, currency locking, backup worker lock, `vm_custom`/`custom` kind mismatch, comment cleanup.

## What's now solid (new since Sep 3)

Payment verification is properly hardened everywhere it mattered; the teardown module follows the outbox conventions correctly and never destroys data on transient failures; the host registry closes the DNS hole with a backfill of all three namespaces; storage namespacing is traversal-safe with signed URLs covered; the redirect allowlist does exact-origin matching on both auth paths; env validation now fails fast on placeholder secrets; `/api/status` went from a ~500k-row query to aggregated SQL with a cache. And the whole tree tests green: 171 passing, 0 failing.

---

*Housekeeping: your `.git` had a stale `index.lock` blocking all git operations — I moved it to `_to_delete/git-index.lock`. Both audit tarballs (`_audit_snapshot.tgz`, `_audit_snapshot2.tgz`) are also candidates for `_to_delete/` — and a 50MB `site-controller-1.0.2.tar.gz` sits in the repo root; keep it out of git.*
