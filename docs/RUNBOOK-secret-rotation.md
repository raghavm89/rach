# RUNBOOK — Secret Rotation (pre-launch, go-live audit P0 #9)

**Why:** live production credentials sat in `apps/rachbase-backend/.env` and `secrets/` on disk.
`git ls-files` confirmed neither `.env` nor `secrets/` is tracked in git, so this is disk/copy
exposure (laptop, backups, zips, any folder snapshot), **not** public git-history exposure — with
one exception: `apps/rachbase-backend/scripts/invoice-input.json` (real customer PII) *was* tracked
and is therefore in git history (see §6).

Rotating is cheap insurance. Do it once before launch. **Claude cannot rotate these for you** —
each rotation happens in the provider's own console with the live secret value, which must never be
pasted into a chat. This runbook is the checklist; you run it.

## 0. Repo hardening already applied (code side, this change)
- `secrets/`, `*.key`, `*.pem`, `**/*.tsbuildinfo`, and `scripts/invoice-input.json` are now in
  `.gitignore` **and** `.dockerignore` — they can no longer be committed or copied into an image.
- `invoice-input.json` was `git rm --cached` (untracked; the working file stays on disk, ignored).
- `.env.example` duplicate line that left `RACHBASE_SERVICE_TOKEN=chan` (4 chars) is removed.
- `validateEnv` now refuses to boot on any placeholder (`change_me*`, `your_*`, `test_secret`, …)
  or any secret shorter than 16 chars, across the full secret set (incl. `RACHBASE_SERVICE_TOKEN`,
  `RACHBASE_KEY_ENC_SECRET`, `GITHUB_APP_WEBHOOK_SECRET`).

## 1. Razorpay key + secret  (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
Blast radius: the secret can forge payment signatures. **Highest priority.**
1. Razorpay Dashboard → Settings → API Keys → **Regenerate**. (Live keys — do this in a low-traffic
   window; in-flight checkouts using the old key will fail and must be retried.)
2. Update the secret in the host env store (Railway/host variables), not in a file.
3. Also rotate the **webhook secret** (`RAZORPAY_WEBHOOK_SECRET`): Dashboard → Webhooks → edit →
   set a new secret → update the env var. Verify a test event still validates.

## 2. JWT signing secrets  (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`)
Blast radius: the access secret mints admin tokens.
- Generate: `openssl rand -base64 48` for each (two different values).
- **Rotating these invalidates every existing token → every user is logged out.** Do it now, before
  you have a userbase, rather than after. Update both env vars together and restart.

## 3. Deploy SSH key  (root on every tenant VM)
1. Generate a new keypair: `ssh-keygen -t ed25519 -f rachbase_deploy_new -C rachbase-deploy`.
2. Add the **new public** key to each VM's `authorized_keys` (via your ARKA/host provisioning), then
   swap the private key in the deploy env/secret store, deploy, and verify a deploy works.
3. Only after verifying, **remove the old public key** from every VM's `authorized_keys`.

## 4. GitHub App private key + webhook secret
1. GitHub → Settings → Developer settings → GitHub Apps → (your app) → **Generate a private key**;
   update `GITHUB_APP_PRIVATE_KEY` in the env store; delete the old key in the GitHub UI.
2. Set/rotate the App **webhook secret** and update `GITHUB_APP_WEBHOOK_SECRET`. The webhook handler
   now **fails closed** if this is unset, so it must be present in prod.

## 5. Other credentials on disk (rotate as convenient)
`RACHBASE_SERVICE_TOKEN` (guards `/internal/run-command` → command exec on tenant VMs — treat as
high value), `RACHBASE_KEY_ENC_SECRET`, Anthropic / Brevo / GoDaddy / Grafana keys, `DB_PASSWORD`,
and the `secrets/` material (mTLS `ca.key`/`client.key`, `oauth.key`). Regenerate the tokens; for
the mTLS CA re-issuing the client cert is a coordinated change with ARKA — schedule it.

## 6. Purge the tracked PII from git history  (`invoice-input.json`)
Untracking (done) stops future commits but does **not** remove it from history. To purge:
```
# Back up first. This REWRITES history and needs a force-push; coordinate with anyone who has a clone.
git filter-repo --path apps/rachbase-backend/scripts/invoice-input.json --invert-paths
git push --force-with-lease --all
```
(Or use BFG.) Anyone with the customer's data on file should also be handled per your DPDP erasure
process. This is your call to run — Claude will not rewrite history for you.

## 7. Post-rotation verification
- Boot the backend: `validateEnv` should pass (no placeholder/short-secret refusal).
- One real ₹ and one $ checkout end-to-end (subscribe → deploy → cancel → verify teardown).
- A Razorpay webhook delivers and validates; a GitHub webhook delivers and validates.
- `git status` shows `secrets/`, `.env`, and `invoice-input.json` as ignored/untracked.
