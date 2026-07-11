# RachBase & RachDev — Branding & Docs Copy

Companion to the split plan. Drop-in positioning and README copy for both brands, grounded in what each product actually does today.

---

## RachBase — Cloud Management / BaaS

### Positioning

**One-liner:** RachBase is a Backend-as-a-Service platform that provisions, deploys, and monitors your infrastructure — so you ship product, not plumbing.

**Elevator pitch:** RachBase gives teams a managed control plane for their cloud: spin up VMs, deploy straight from GitHub, monitor everything in one dashboard, manage tenants and teams, and handle billing and usage — without stitching together five tools. It's the infrastructure layer that RachDev's agents run on, now available as its own product.

**Who it's for:** engineering teams and product companies that need managed VMs, deployments, and monitoring without building a platform team.

### What it does (feature pillars)

- **Provisioning** — allocate and manage VMs, assign them to tenants, expand capacity on demand.
- **Deployments** — deploy from GitHub with webhook-driven pipelines; run commands over secure SSH.
- **Monitoring** — real-time metrics (Prometheus-backed), VM health, alerting.
- **Multi-tenancy** — tenants, teams, roles, and per-tenant isolation out of the box.
- **Billing & usage** — plans, subscriptions, orders, credit-based usage metering, Razorpay payments.

### Tagline options

1. *Your backend, managed.*
2. *Ship product, not plumbing.*
3. *The control plane for your cloud.*

### Boilerplate (for footers, about pages, decks)

> RachBase is a cloud management and Backend-as-a-Service platform for provisioning, deploying, and monitoring infrastructure. Teams use RachBase to run VMs, ship deployments from GitHub, monitor health in real time, and manage tenants and billing — all from a single dashboard.

---

## RachDev — AI Solutions / Agent Builder

### Updated positioning (post-split)

**One-liner:** RachDev is an AI agent builder — design, run, and deploy autonomous agents that do real work.

**What changed:** RachDev sheds its cloud/infrastructure side (now **RachBase**) and focuses entirely on the agent platform. Under the hood, RachDev runs on RachBase for provisioning and deployment — but to customers, RachDev is purely about building and shipping AI agents.

**Who it's for:** teams building AI-powered products, internal automations, and industry-specific agent solutions.

### What it does

- **Build agents** — conversational agent sessions powered by frontier models.
- **Run & deploy** — trigger deployments and run agent workloads on managed infrastructure (via RachBase).
- **Industry solutions** — tailored agent demos and templates for specific verticals.
- **Usage & credits** — credit-based metering for agent runs.

### Boilerplate

> RachDev is an AI agent builder for designing, running, and deploying autonomous agents. Teams use RachDev to turn AI models into working software — from conversational agents to industry-specific automations — running on managed infrastructure.

---

## How the two brands relate (for the website / sales)

Keep this crisp so customers aren't confused by two names:

> **RachDev** builds the agents. **RachBase** runs the infrastructure. RachDev is powered by RachBase — and now RachBase is available on its own for teams who just need the cloud platform.

Suggested cross-links: RachDev's site links "Infrastructure by RachBase"; RachBase's site links "Building AI agents? See RachDev."

---

## Draft README — rachbase-web

```markdown
# RachBase

Cloud management & Backend-as-a-Service. Provision VMs, deploy from GitHub,
monitor in real time, and manage tenants and billing — from one dashboard.

## Features
- VM provisioning & tenant assignment
- GitHub-driven deployments with SSH command execution
- Real-time monitoring & alerting (Prometheus)
- Multi-tenant teams, roles, and access control
- Plans, subscriptions, usage credits, and payments (Razorpay)

## Getting started
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Architecture
- Next.js frontend (dashboard + BaaS marketing)
- Node/Express API (`rachbase-backend`)
- Postgres (system of record: users, tenants, VMs, billing)
- Shared core via `@rach/core`

RachBase is the platform layer that RachDev (agent builder) runs on.
```

---

## Draft README — rachdev-web (updated)

```markdown
# RachDev

AI agent builder — design, run, and deploy autonomous agents.

## Features
- Conversational agent sessions (frontier models)
- Deploy & run agent workloads on managed infra (via RachBase)
- Industry-specific agent templates & demos
- Credit-based usage metering

## Getting started
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Architecture
- Next.js frontend (agent builder + demos)
- Node/Express API (`rachdev-backend`)
- Runs on RachBase for provisioning, deployment, auth, and billing
- Shared core via `@rach/core`
```
```

---

## Notes

- The current frontend README is the stock create-next-app boilerplate — replace it with the drafts above during Phase 5.
- Marketing already has `products/agent-builder` and `products/baas` pages; these become the anchor pages for each brand's positioning.
- No `RachBase` string exists in the code yet, so brand copy can be introduced cleanly without conflicting with legacy naming.
