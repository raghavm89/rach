# RachBase — Phase 2 Backlog (Dashboard UX + "solve the deploy pain")

Goal: enhance the customer dashboard, and turn the friction we hit deploying on
**Railway + Vercel** into things RachBase does better out of the box.

Legend: 🔥 = pain we personally hit in Phase 1 · 🎨 = pure UX polish · 🧩 = known gap in the current app · ⭐ = differentiator

---

## ⭐ Headline insight from Phase 1

**Why we left Railway for the frontend:** Railway only gives a **CNAME target**,
and GoDaddy (like most registrars) can't put a CNAME on the apex `@`. Vercel won
because it provides a **stable anycast IP** (`76.76.21.21`) you can drop straight
into `A @`. RachBase is *already* better positioned here — its custom-domain flow
uses **`A → IP`** (apex-friendly by design). The work is to (1) surface that IP in
a copy-paste record card, and (2) offer a **stable/anycast IP or load-balancer
IP** so it never changes when a VM does. Nail this and RachBase beats Railway on
the exact thing that forced the switch.

**What Vercel got right (keep/match):** it **auto-recognized the monorepo** with
zero config. RachBase should do the same — detect workspace root + app subdir
automatically.

---

## A. Deployment experience — beat Railway/Vercel at their own game

- [ ] ⭐🔥 **Zero-config framework + monorepo detection.** Nixpacks guessed `pnpm`
      from a stray `pnpm-workspace.yaml`; Vercel defaulted the preset to "Other"
      → 404. **Vercel's monorepo auto-detection was the one thing that "just
      worked" — match it.** RachBase should detect Next/monorepo correctly
      (workspace root + app subdir) and show what it detected before building
      (framework, package manager, workspace root).
- [ ] 🔥 **No build-vs-start confusion.** We lost hours on `next start` vs
      standalone, build command in the start slot, etc. RachBase should pick the
      right run command automatically for the detected framework.
- [ ] 🔥 **Build-time vs runtime env vars, made obvious.** `NEXT_PUBLIC_*` are
      baked at build; we set them and forgot to redeploy, and once pasted the
      var *name* into the *value*. Features: label build-time vars, validate
      URLs (scheme, no trailing slash), and prompt "redeploy needed" when a
      build-time var changes.
- [ ] 🔥 **Automatic port/host binding.** The "train has not arrived" saga was a
      `PORT`/`HOSTNAME` mismatch. RachBase should inject and bind these for the
      user — never make them hand-set a port.
- [ ] ⭐🔥 **Apex-friendly custom domains via a stable IP** (the reason we left
      Railway). RachBase already uses `A → IP`; make it shine: expose a
      **stable/anycast (or load-balancer) IP** users drop into `A @`, a
      copy-paste record card (Type/Name/Value with the real IP + `www` CNAME),
      live "DNS detected / SSL issued" status, and clear per-service targets. No
      registrar apex-CNAME dead-ends.
- [ ] 🔥 **Guided DNS for all the edge cases** — apex vs `www`, GoDaddy
      forwarding, wrong-service attachment, stale targets, SSL provisioning
      waits. Detect the registrar-can't-CNAME-apex situation and guide around it.
- [ ] 🔥 **Service linking + auto-CORS.** Wiring `NEXT_PUBLIC_API_URL` and the
      backend's `CORS_ORIGINS` by hand was error-prone. Let users "link" web ↔
      backend and auto-populate the API URL and allowed origins.
- [ ] 🔥 **Actionable build errors.** We hit duplicate-React (`useContext` null),
      `@rach/ui` module resolution, and `React.cache` errors with cryptic
      traces. Surface common failures with plain-English hints + fix links.
- [ ] 🔥 **Guided migrations + admin bootstrap.** Running `migrate` and
      `create-admin` against the prod DB needed CLI gymnastics. Offer a one-off
      "run task" / release-step UI and a first-admin setup flow.
- [ ] **Preview deploys + one-click rollback.** Per-branch previews and instant
      rollback to a previous good build.

## B. Customer dashboard — UX polish & gaps

- [ ] 🧩 **Replace remaining mock data.** `ProjectSwitcher` (mockProjects) and
      `SchemaViewer` (mockTables) still render fake data (TopBar is already
      wired to the real user).
- [ ] 🔥🎨 **Custom-domain card parity.** Earlier we noted the Domains section
      only says "point the A record at the VM's IP" without showing the IP.
      Add a Railway-style copy-paste record card (Type/Name/Value with the real
      IP), plus the live status badge you already poll.
- [ ] 🎨 **Live build/deploy log streaming** in the dashboard (not just final
      status), with the actionable-error hints from section A.
- [ ] 🎨 **Env var management UI** — build vs runtime grouping, secret masking,
      "changed → redeploy" prompts.
- [ ] 🎨 **Onboarding & empty states** — first-run guidance for a new project
      (create service → add domain → deploy), so users aren't staring at a blank
      canvas.
- [ ] 🎨 **Deployment canvas enhancements** — clearer connection/status cues,
      inline actions, maybe drag-to-link services.
- [ ] 🎨 **Notifications/alerts surfacing** — the backend already runs
      `alertMonitor`/`endpointProber`; surface those events in the UI.

## D. Railway UX patterns to adopt (things you liked)

State markers: ✅ already built · ⚠️ exists but on mock data · 🔨 build from scratch · 🗂️ IA/reorg

Overarching pattern worth adopting: Railway's **consistent per-resource tabbed
detail view** (a service = Deployments / Variables / Metrics / Console /
Settings; Postgres = Data / Backups / Config / Console). It gives every item
below a natural home.

- [ ] 🔨 **Grouping of service cards.** Let users group/label related services on
      the canvas (e.g. by environment or function). New — the canvas has cards
      but no grouping concept.
- [x] ✅ **Project naming.** Already supported (`projects.name`).
- [x] ✅ **Multiple projects** with the full **Project → Environment → Service**
      model and routes already exist. ⚠️ Remaining: `ProjectSwitcher` still
      renders **mock** projects — wire it to the real API.
- [ ] 🗂️ **SSH terminal in a "Console" tab.** The terminal already works (xterm +
      `terminalServer`). Reorganize the per-service view so it lives in a
      Console tab (Railway-style), with a "Copy SSH command" affordance.
- [ ] 🔨 **Postgres data viewer + query runner.** `SchemaViewer` exists but shows
      **mock** tables, and there's **no query-runner endpoint** yet. Build: a
      real table browser + a `SELECT …` query box with results grid (the Railway
      "Data" tab experience), tenant-scoped and permission-guarded.

## C. Reliability / observability

- [ ] **Per-service health & status** at a glance (uses existing `/health`,
      `/ready`, endpoint monitoring).
- [ ] **Resource/usage views** tied to billing (VM CPU/RAM, credits) — some of
      this exists; make it cohesive.

---

## How we'll work this
1. You mark **priority** (P0/P1/P2) on the items that matter for the next sprint.
2. Add anything I missed (your own pain points / customer requests).
3. We pick 2–3 P0s and I'll break each into concrete implementation tasks.
