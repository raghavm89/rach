export interface Feature {
  id: number;
  slug: string;
  name: string;
  icon: string;
  image?: string;
  category: "baas" | "agents" | "platform";
  shortDescription: string;
  fullDescription: string;
  benefits: string[];
  relatedFeatures: string[];
}

export const features: Feature[] = [
  // ─── BaaS Features ───────────────────────────────────────────────
  {
    id: 1,
    slug: "managed-postgresql",
    name: "Managed PostgreSQL",
    icon: "Database",
    category: "baas",
    shortDescription:
      "Every project gets a dedicated Postgres instance with pgvector, automated backups, point-in-time recovery, and built-in connection pooling.",
    fullDescription: `Rach Dev LLP provisions a fully managed, dedicated PostgreSQL instance for every project you create. Unlike shared database clusters where noisy neighbors can degrade your performance, each database runs in its own isolated environment with guaranteed resources. We support PostgreSQL 15+ with the pgvector extension pre-installed, so you can store and query vector embeddings alongside your relational data without managing a separate vector database.

Automated daily backups run without any configuration. Every backup is encrypted at rest using AES-256 and stored in a separate availability zone from your primary database. Point-in-time recovery lets you restore your database to any second within the last 30 days, which means an accidental DELETE statement at 3:47 PM can be undone by rewinding to 3:46 PM. Cross-region replication is available on Growth and Scale plans for disaster recovery and low-latency reads.

Connection pooling via PgBouncer is built into every instance, handling thousands of concurrent connections without overwhelming your database. You get full superuser access, so you can install extensions, create custom functions, and tune your configuration. We monitor query performance, storage utilization, and connection counts, alerting you before problems become outages.`,
    benefits: [
      "Dedicated instance per project with guaranteed CPU and memory — no noisy neighbors",
      "pgvector pre-installed for AI embeddings, enabling semantic search and RAG without a separate vector DB",
      "Automated encrypted backups with point-in-time recovery to any second in the last 30 days",
      "Built-in PgBouncer connection pooling supporting thousands of concurrent connections",
      "Full superuser access to install extensions, create functions, and tune configurations",
      "Cross-region replication available for disaster recovery and low-latency global reads",
    ],
    relatedFeatures: [
      "connection-pooling",
      "backups-recovery",
      "row-level-security",
      "auto-generated-apis",
    ],
  },
  {
    id: 2,
    slug: "authentication",
    name: "Authentication",
    icon: "ShieldCheck",
    category: "baas",
    shortDescription:
      "Complete auth system with email/password, OAuth providers, magic links, JWT tokens, row-level security integration, and multi-tenant user management.",
    fullDescription: `Rach Dev LLP Authentication gives you a production-ready auth system that works out of the box. Support for email/password, OAuth providers (Google, GitHub, Apple, Microsoft), magic link passwordless login, and phone OTP is included from day one. Every authenticated user gets a JWT that automatically integrates with your database's row-level security policies, so authorization happens at the database layer rather than in scattered application code.

Multi-tenant user management is built into the core. You can create organizations, assign roles, and enforce permissions hierarchically. A user can belong to multiple organizations with different roles in each. Session management includes configurable token lifetimes, refresh token rotation, and the ability to revoke all sessions for a user instantly. We handle password hashing with Argon2id, rate limit login attempts, and detect credential stuffing automatically.

For developers, the authentication API is straightforward. A single function call signs users in, and JWT claims are automatically available in your RLS policies. Custom claims let you attach metadata like subscription tier or feature flags to tokens. Webhook events fire on signup, login, password reset, and account deletion so you can trigger downstream workflows without polling.`,
    benefits: [
      "Email, OAuth, magic link, and phone OTP auth methods ready out of the box",
      "JWTs integrate directly with Postgres row-level security for database-layer authorization",
      "Multi-tenant user management with organizations, roles, and hierarchical permissions",
      "Argon2id password hashing, rate limiting, and credential stuffing detection included",
      "Custom JWT claims for attaching subscription tiers, feature flags, or metadata",
      "Webhook events on signup, login, password reset, and deletion for workflow automation",
    ],
    relatedFeatures: [
      "row-level-security",
      "auto-generated-apis",
      "realtime-subscriptions",
    ],
  },
  {
    id: 3,
    slug: "auto-generated-apis",
    name: "Auto-Generated APIs",
    icon: "Zap",
    category: "baas",
    shortDescription:
      "Instant REST and GraphQL APIs generated from your database tables with filtering, pagination, sorting, and realtime subscriptions.",
    fullDescription: `Every table you create in your Rach Dev LLP database automatically gets a fully functional REST API and GraphQL endpoint. There is no code generation step, no schema files to maintain, and no deployment needed. When you add a column, the API updates instantly. When you create a relationship between tables, nested queries become available automatically. The APIs respect your row-level security policies, so you can safely expose them to client applications.

The REST API follows PostgREST conventions, giving you powerful filtering with operators like eq, neq, gt, lt, in, like, and full-text search. Pagination supports both offset and cursor-based strategies. You can request specific columns, embed related resources, and batch multiple operations in a single request. The GraphQL endpoint mirrors the same capabilities with a fully typed schema that updates in real time as your database evolves.

Realtime subscriptions are available on both REST (via Server-Sent Events) and GraphQL (via WebSocket). Subscribe to INSERT, UPDATE, and DELETE events on any table, optionally filtered by column values. This means you can build live dashboards, chat applications, or collaborative editing features without writing any backend code. Rate limiting, request size limits, and query complexity analysis protect your database from abuse.`,
    benefits: [
      "Instant REST and GraphQL endpoints from tables — no code generation or deployment needed",
      "Rich filtering with eq, neq, gt, lt, in, like, and full-text search operators",
      "Cursor-based and offset pagination with configurable page sizes",
      "Realtime subscriptions via SSE and WebSocket for live data features",
      "Automatic schema updates when you modify tables or relationships",
      "Row-level security enforcement on every API request for safe client-side access",
    ],
    relatedFeatures: [
      "managed-postgresql",
      "authentication",
      "realtime-subscriptions",
      "row-level-security",
    ],
  },
  {
    id: 4,
    slug: "object-storage",
    name: "Object Storage",
    icon: "HardDrive",
    category: "baas",
    shortDescription:
      "Secure file uploads with CDN delivery, granular access control policies, on-the-fly image transformations, and virus scanning.",
    fullDescription: `Rach Dev LLP Object Storage provides S3-compatible file storage tightly integrated with your database and auth system. Upload files via a simple API or client library, and they are stored in your project's dedicated storage bucket. Access control policies work identically to database RLS — you write rules that reference the authenticated user's JWT claims, so a user can only access their own uploads unless you explicitly grant broader access.

Every uploaded file is served through a global CDN with edge caching, so your users get fast downloads regardless of their location. Image files can be transformed on the fly — resize, crop, convert format, adjust quality — via URL parameters. These transformations are cached at the edge, so the first request generates the variant and subsequent requests are served instantly. This eliminates the need for a separate image processing pipeline.

Virus scanning runs automatically on upload. Files that fail the scan are quarantined and never served. You can set per-bucket size limits, file type restrictions, and upload rate limits. Signed URLs provide time-limited access to private files. Multipart uploads handle large files efficiently with automatic retry on failure. Storage usage is metered per GB with no egress fees within the included CDN bandwidth.`,
    benefits: [
      "S3-compatible API with auth-aware access control policies matching your database RLS",
      "Global CDN delivery with edge caching for fast downloads worldwide",
      "On-the-fly image transformations (resize, crop, format conversion) via URL parameters",
      "Automatic virus scanning on upload with quarantine for failed files",
      "Signed URLs for time-limited access to private files",
      "Multipart uploads with automatic retry for reliable large file handling",
    ],
    relatedFeatures: [
      "authentication",
      "row-level-security",
      "auto-generated-apis",
    ],
  },
  {
    id: 5,
    slug: "realtime-subscriptions",
    name: "Realtime Subscriptions",
    icon: "Radio",
    category: "baas",
    shortDescription:
      "WebSocket channels with presence detection, broadcast messaging, and database change listeners for building live, collaborative features.",
    fullDescription: `Rach Dev LLP Realtime gives you three primitives for building live features: database change listeners, broadcast channels, and presence tracking. Database change listeners let you subscribe to INSERT, UPDATE, and DELETE events on any table, with optional filters so you only receive the events you care about. Every event includes the old and new row data, making it straightforward to update client-side state.

Broadcast channels provide pub/sub messaging between connected clients without touching the database. This is ideal for features like live cursors, typing indicators, in-app notifications, or multiplayer game state. Messages are delivered with sub-50ms latency within a region. You can create as many channels as you need, and clients can subscribe to multiple channels simultaneously. Channel authorization is handled via the same JWT-based policies used everywhere else in the platform.

Presence tracking lets you see which users are currently online in a channel. Each user can attach arbitrary metadata to their presence state — for example, their cursor position, current page, or status. When a user joins, leaves, or updates their state, all other subscribers receive the change. Presence is automatically cleaned up when a WebSocket disconnects, with configurable timeout for detecting dropped connections versus intentional departures.`,
    benefits: [
      "Database change listeners for INSERT, UPDATE, and DELETE with row-level filtering",
      "Broadcast channels for pub/sub messaging with sub-50ms latency within a region",
      "Presence tracking showing online users with custom metadata like cursor position",
      "JWT-based channel authorization using the same policies as your database",
      "Automatic presence cleanup on disconnect with configurable timeout",
      "Support for multiple simultaneous channel subscriptions per client",
    ],
    relatedFeatures: [
      "auto-generated-apis",
      "authentication",
      "managed-postgresql",
    ],
  },
  {
    id: 6,
    slug: "backups-recovery",
    name: "Backups & Recovery",
    icon: "RotateCcw",
    category: "baas",
    shortDescription:
      "Automated daily backups with point-in-time recovery, cross-region replication, and one-click restore — so you never lose data.",
    fullDescription: `Data loss is not an option when your AI agents depend on your database. Rach Dev LLP runs automated backups of your PostgreSQL database every 24 hours, with write-ahead log (WAL) archiving that captures every transaction in between. This combination enables point-in-time recovery (PITR), allowing you to restore your database to any specific second within a rolling 30-day window. An accidental schema migration gone wrong at 2:15 PM? Restore to 2:14 PM and try again.

All backups are encrypted at rest using AES-256 and stored in a separate availability zone from your primary database. On Growth and Scale plans, backups are additionally replicated to a different geographic region, protecting against regional outages. You can initiate a restore from the dashboard with a single click, specifying either "latest backup" or an exact timestamp. Restores create a new database instance, so your production database remains untouched until you verify the restore and swap.

For teams that need to manage their own backup strategy, we also provide on-demand backup triggers via the API. You can snapshot your database before a risky migration, download backup files for local testing, or pipe backups to your own S3 bucket for additional retention. Backup health monitoring alerts you if a backup job fails or if WAL archiving falls behind, so you are never silently unprotected.`,
    benefits: [
      "Automated daily backups with WAL archiving for point-in-time recovery to any second",
      "30-day rolling retention window for all backups and transaction logs",
      "AES-256 encryption at rest with storage in a separate availability zone",
      "Cross-region replication on Growth and Scale plans for disaster recovery",
      "One-click restore from dashboard — creates a new instance without touching production",
      "On-demand backup triggers via API for pre-migration snapshots and local testing",
    ],
    relatedFeatures: [
      "managed-postgresql",
      "dedicated-infrastructure",
      "connection-pooling",
    ],
  },
  {
    id: 7,
    slug: "connection-pooling",
    name: "Connection Pooling",
    icon: "Network",
    category: "baas",
    shortDescription:
      "Built-in PgBouncer with session and transaction pooling modes, automatic scaling, and support for thousands of concurrent connections.",
    fullDescription: `PostgreSQL has a hard limit on concurrent connections, and each connection consumes significant memory. Without a connection pooler, serverless applications and AI agent deployments that spawn many short-lived connections will quickly exhaust your database. Rach Dev LLP includes PgBouncer as a built-in connection pooler on every project, configured and optimized so you never think about connection limits.

Two pooling modes are available. Transaction mode releases the server connection back to the pool after each transaction completes, maximizing connection reuse for workloads with many short queries. Session mode holds the connection for the duration of the client session, which is required for features like prepared statements and advisory locks. You can switch modes per connection string, so different parts of your application can use different strategies.

The pooler automatically scales its pool size based on your database plan's resources. On the Starter plan, you get up to 200 pooled connections. Growth supports 500, and Scale supports 2,000+. Connection queuing handles burst traffic gracefully — when all connections are in use, new requests queue for up to 5 seconds before timing out, which is enough to absorb most spikes. Monitoring shows active connections, waiting requests, and pool utilization in real time.`,
    benefits: [
      "Built-in PgBouncer with zero configuration required on every project",
      "Transaction mode for maximum connection reuse in serverless and agent workloads",
      "Session mode available for prepared statements, advisory locks, and LISTEN/NOTIFY",
      "Automatic pool sizing based on plan resources — up to 2,000+ connections on Scale",
      "Connection queuing absorbs traffic bursts with configurable timeout",
      "Real-time monitoring of active connections, waiting requests, and pool utilization",
    ],
    relatedFeatures: [
      "managed-postgresql",
      "dedicated-infrastructure",
      "auto-generated-apis",
    ],
  },
  {
    id: 8,
    slug: "row-level-security",
    name: "Row-Level Security",
    icon: "Lock",
    category: "baas",
    shortDescription:
      "Postgres RLS policies for tenant isolation, user-scoped data access, and declarative permissions enforced at the database layer.",
    fullDescription: `Row-level security (RLS) moves authorization from your application code into the database itself. Instead of writing middleware that checks "does this user own this record?" on every endpoint, you define a policy once on the table: "users can only see rows where user_id matches their JWT." The database enforces this on every query — SELECT, INSERT, UPDATE, DELETE — regardless of whether the query comes from your API, a direct SQL connection, or a realtime subscription.

Rach Dev LLP makes RLS practical by integrating it with our authentication system. The authenticated user's JWT is automatically available in RLS policy expressions via the auth.uid() and auth.jwt() helper functions. This means you can write policies that reference the user's ID, their organization, their role, or any custom claim attached to their token. Multi-tenant isolation becomes a one-line policy: "rows where org_id = auth.jwt()->>'org_id'" ensures tenants never see each other's data.

For complex authorization scenarios, you can combine multiple policies with AND/OR logic, create policies that reference other tables (e.g., "allow access if user is a member of the project's team"), and use security definer functions for reusable permission logic. We provide a policy editor in the dashboard with syntax highlighting and validation, plus a testing tool that lets you preview query results as any user to verify your policies work correctly before deploying.`,
    benefits: [
      "Authorization enforced at the database layer on every query — SELECT, INSERT, UPDATE, DELETE",
      "Automatic JWT integration with auth.uid() and auth.jwt() helpers in policy expressions",
      "Multi-tenant isolation with a single policy line — tenants never see each other's data",
      "Complex policies combining multiple conditions, cross-table references, and reusable functions",
      "Dashboard policy editor with syntax highlighting, validation, and per-user preview testing",
      "Applies to all access paths: API, direct SQL, realtime subscriptions, and server functions",
    ],
    relatedFeatures: [
      "authentication",
      "auto-generated-apis",
      "managed-postgresql",
      "realtime-subscriptions",
    ],
  },

  // ─── Agent Features ──────────────────────────────────────────────
  {
    id: 9,
    slug: "agent-templates",
    name: "Agent Templates",
    icon: "LayoutTemplate",
    category: "agents",
    shortDescription:
      "60 production-tested agent templates across 15 industries — from e-commerce support bots to healthcare appointment schedulers — ready to deploy in minutes.",
    fullDescription: `Building an AI agent from scratch means defining conversation flows, writing system prompts, configuring guardrails, setting up integrations, and testing hundreds of edge cases. Rach Dev LLP's template library shortcircuits this process by giving you 60 pre-built agent configurations that have been tested in production across real businesses. Each template includes a tuned system prompt, predefined conversation flows, industry-appropriate guardrails, and integration scaffolding.

Templates are organized across 15 industries: e-commerce, healthcare, real estate, legal, financial services, education, hospitality, SaaS, recruitment, professional services, insurance, automotive, non-profit, fitness and wellness, and food and beverage. Within each industry, four templates cover the most common use cases — customer support, lead qualification, scheduling, and domain-specific workflows. Every template has been refined based on thousands of real conversations to handle edge cases, ambiguous inputs, and adversarial prompts.

Starting from a template does not lock you in. Every aspect is customizable through our natural language configuration system. You can adjust the tone, add new conversation flows, change integration targets, and modify guardrails. Templates are versioned, so when we improve a template based on aggregate performance data, you can choose to merge the improvements into your customized version or stay on your current configuration.`,
    benefits: [
      "60 production-tested templates across 15 industries ready to deploy in minutes",
      "Pre-configured system prompts, conversation flows, guardrails, and integration scaffolding",
      "Refined from thousands of real conversations for edge case and adversarial input handling",
      "Fully customizable through natural language — adjust tone, flows, integrations, and guardrails",
      "Versioned templates with optional merge when upstream improvements are released",
      "Covers the four most common use cases per industry: support, leads, scheduling, and workflows",
    ],
    relatedFeatures: [
      "nlp-configuration",
      "sandbox-testing",
      "one-click-deploy",
      "human-escalation",
    ],
  },
  {
    id: 10,
    slug: "nlp-configuration",
    name: "NLP Configuration",
    icon: "MessageSquare",
    category: "agents",
    shortDescription:
      "Configure and customize your AI agents through natural language conversation — describe what you want in plain English and watch the agent adapt in real time.",
    fullDescription: `Traditional chatbot builders force you into flowchart editors with drag-and-drop nodes, conditional branches, and regex pattern matching. Rach Dev LLP takes a fundamentally different approach: you configure your agent by talking to it. Tell the agent "be more formal when discussing pricing" and the system prompt updates. Say "when a user asks about returns, check their order status first, then explain the policy" and a new conversation flow is created. Every change is previewed in real time in the sandbox.

The NLP configuration system understands intent at a high level and translates it into structured agent configuration. You can define personality traits ("be warm but professional, use the customer's first name"), business rules ("never offer more than 15% discount without manager approval"), knowledge boundaries ("only answer questions about our products, redirect everything else to support@company.com"), and escalation triggers ("transfer to a human if the customer mentions legal action or asks to speak with a manager").

Under the hood, your natural language instructions are compiled into a structured configuration file that includes system prompts, tool definitions, guardrail rules, and routing logic. You can view and edit this configuration directly if you prefer, but most users never need to. The conversation-based approach means non-technical team members — product managers, customer success leads, compliance officers — can shape agent behavior without writing code or learning a configuration syntax.`,
    benefits: [
      "Configure agents by describing behavior in plain English — no flowcharts or code required",
      "Real-time preview of changes in the sandbox as you describe modifications",
      "Non-technical team members can shape agent behavior without developer involvement",
      "Supports personality traits, business rules, knowledge boundaries, and escalation triggers",
      "Compiled into structured configuration that can be viewed and edited directly if preferred",
      "Changes are versioned with full audit trail of who modified what and when",
    ],
    relatedFeatures: [
      "agent-templates",
      "sandbox-testing",
      "one-click-deploy",
    ],
  },
  {
    id: 11,
    slug: "sandbox-testing",
    name: "Sandbox Testing",
    icon: "FlaskConical",
    category: "agents",
    shortDescription:
      "Test your agents in a live sandbox environment with full decision tracing, shareable preview links, and simulated edge cases.",
    fullDescription: `Deploying an untested AI agent to production is like pushing code without running tests. Rach Dev LLP's sandbox environment gives you a production-identical testing ground where you can interact with your agent, trace its decision-making process, and share preview links with stakeholders for approval. The sandbox runs on the same infrastructure as production, so performance characteristics match exactly.

Decision tracing is the standout feature. Every sandbox conversation shows you the agent's internal reasoning: which tools it considered calling, what information it extracted from the user's message, why it chose a particular response, and which guardrails were evaluated. When the agent makes an unexpected choice, you can see exactly why and adjust the configuration accordingly. This transforms agent debugging from guesswork into a systematic process.

Shareable preview links let you send a sandbox URL to anyone — your product manager, compliance team, or client — so they can interact with the agent directly and provide feedback. Preview links are read-only in terms of configuration, so reviewers can chat with the agent but cannot change its behavior. You can create multiple sandbox environments with different configurations to A/B test approaches before committing to one. Simulated scenarios let you replay common and adversarial conversation patterns automatically to verify your agent handles them correctly.`,
    benefits: [
      "Production-identical sandbox environment for realistic testing before deployment",
      "Full decision tracing showing internal reasoning, tool selection, and guardrail evaluation",
      "Shareable preview links for stakeholder review and approval without configuration access",
      "Multiple sandbox environments for A/B testing different agent configurations",
      "Simulated scenario replay for automated testing of common and adversarial conversation patterns",
      "Systematic debugging that reveals exactly why an agent made a specific choice",
    ],
    relatedFeatures: [
      "nlp-configuration",
      "one-click-deploy",
      "agent-templates",
    ],
  },
  {
    id: 12,
    slug: "one-click-deploy",
    name: "One-Click Deploy",
    icon: "Rocket",
    category: "agents",
    shortDescription:
      "Your sandbox runs on production infrastructure — deploying is just flipping a switch. Zero downtime, instant rollback, and automatic scaling.",
    fullDescription: `The gap between "works in testing" and "works in production" is where most AI agent deployments fail. Different infrastructure, different latency profiles, different load characteristics. Rach Dev LLP eliminates this gap entirely: your sandbox environment runs on the exact same infrastructure as production. When you are satisfied with your agent's behavior in the sandbox, deployment is a single toggle. There is no build step, no container to push, no infrastructure to provision.

Deployments are instant and zero-downtime. The new agent version is activated atomically — there is no window where some users hit the old version and others hit the new one. If something goes wrong, rollback is equally instant: one click reverts to the previous version. Every deployment is versioned with a full diff showing what changed, who changed it, and when. You can review the deployment history and restore any previous version at any time.

Auto-scaling handles traffic fluctuations without any configuration. Whether you receive 10 conversations per day or 10,000 per hour, the agent infrastructure scales to match demand. You pay for what you use within your plan's limits, and burst capacity is available for unexpected spikes. Deployment metrics show you conversation volume, response latency, error rates, and escalation frequency in real time so you can verify the new version is performing as expected.`,
    benefits: [
      "Sandbox and production run on identical infrastructure — no deployment surprises",
      "Single-toggle deployment with zero downtime and atomic version activation",
      "Instant rollback to any previous version with one click",
      "Full deployment history with diffs showing changes, authors, and timestamps",
      "Auto-scaling from 10 to 10,000+ conversations per hour without configuration",
      "Real-time deployment metrics: volume, latency, error rates, and escalation frequency",
    ],
    relatedFeatures: [
      "sandbox-testing",
      "dedicated-infrastructure",
      "analytics-dashboard",
    ],
  },
  {
    id: 13,
    slug: "human-escalation",
    name: "Human Escalation",
    icon: "UserCheck",
    category: "agents",
    shortDescription:
      "Graceful handoff to human support when the AI agent cannot resolve an issue, with full conversation context and configurable escalation triggers.",
    fullDescription: `No AI agent can handle every situation. Rach Dev LLP's human escalation system ensures that when an agent reaches its limits, the transition to a human is smooth for the customer and informative for the support team. Escalation triggers are fully configurable: transfer when the customer explicitly asks for a human, when the agent's confidence drops below a threshold, when the conversation involves sensitive topics, or when a VIP customer is detected.

When escalation occurs, the entire conversation history, extracted customer information, and the agent's internal assessment are packaged into a structured handoff. This means the human agent does not start from zero — they see what the customer asked, what the AI tried, and why it escalated. Integration with popular support platforms (Zendesk, Intercom, Freshdesk, HubSpot) routes the handoff to the right team with the right priority automatically.

Escalation analytics track how often escalation happens, the most common reasons, and the resolution outcomes. This feedback loop is critical for improving your agent over time. If 30% of escalations are about a specific topic, you know exactly where to focus your next round of agent training. You can also configure "warm handoff" mode where the AI agent stays in the conversation alongside the human agent, suggesting responses and pulling up relevant information to speed up resolution.`,
    benefits: [
      "Configurable triggers: explicit request, low confidence, sensitive topics, VIP detection",
      "Structured handoff including full conversation history, extracted data, and AI assessment",
      "Native integration with Zendesk, Intercom, Freshdesk, and HubSpot for automatic routing",
      "Escalation analytics showing frequency, reasons, and resolution outcomes for agent improvement",
      "Warm handoff mode where AI assists the human agent with suggestions and information retrieval",
      "Graceful customer experience — users feel helped, not abandoned, during the transition",
    ],
    relatedFeatures: [
      "agent-templates",
      "analytics-dashboard",
      "nlp-configuration",
    ],
  },

  // ─── Platform Features ───────────────────────────────────────────
  {
    id: 14,
    slug: "dedicated-infrastructure",
    name: "Dedicated Infrastructure",
    icon: "Server",
    category: "platform",
    shortDescription:
      "Isolated tenant infrastructure with no shared resources. Available in US and India regions with SOC 2 compliance and 99.95% uptime SLA.",
    fullDescription: `Multi-tenant platforms save costs by sharing resources between customers, but that shared model creates security risks, performance variability, and compliance headaches. Rach Dev LLP takes the opposite approach: every customer gets isolated infrastructure. Your database, your agent runtime, your file storage, and your API gateway all run on dedicated resources that no other customer can access or impact.

This isolation matters for performance, security, and compliance. On the performance side, another customer's traffic spike will never slow down your agents or database queries. On the security side, there is no risk of data leakage between tenants — your resources are physically separated at the infrastructure level, not just logically separated by software. On the compliance side, you can demonstrate to auditors exactly where your data lives, who can access it, and that no other entity shares those resources.

We currently operate in two regions: US East (Virginia) and India West (Mumbai), with Europe (Frankfurt) coming in Q3 2026. You choose your region at project creation, and all data stays within that region. For customers who need multi-region deployment, we can configure primary and replica infrastructure across both regions. Our SLA guarantees 99.95% uptime for production workloads on all paid plans, backed by service credits.`,
    benefits: [
      "Fully isolated infrastructure per customer — no shared databases, runtimes, or storage",
      "No noisy neighbor risk: other customers' traffic cannot impact your performance",
      "US East and India West regions with data residency guarantees — Europe coming Q3 2026",
      "99.95% uptime SLA on all paid plans backed by service credits",
      "Simplified compliance auditing with clear data isolation and location documentation",
      "Multi-region deployment available for customers needing global redundancy",
    ],
    relatedFeatures: [
      "managed-postgresql",
      "backups-recovery",
      "analytics-dashboard",
    ],
  },
  {
    id: 15,
    slug: "developer-support",
    name: "Developer Support",
    icon: "Headphones",
    category: "platform",
    shortDescription:
      "Real engineers on every support interaction — not chatbots or ticket routers. Custom integrations, database migrations, and architecture reviews included.",
    fullDescription: `When you file a support request with Rach Dev LLP, a real engineer responds. Not a chatbot. Not a tier-1 support rep reading from a script. Not a ticket that sits in a queue for 48 hours. Our support team consists of the same engineers who build the platform, which means they can diagnose complex issues, write custom integration code, and make infrastructure changes when needed. Response times are under 4 hours on business plans and under 1 hour on Scale plans.

Beyond reactive support, we offer proactive developer services. Migrating from another database provider? Our team will handle the schema migration, data transfer, and connection string updates. Need a custom integration with an internal tool? We will build it. Want an architecture review before you launch? Schedule a call with an engineer who will review your schema, RLS policies, agent configuration, and deployment setup. These services are included in Growth and Scale plans, not hidden behind a consulting fee.

Documentation is comprehensive, but we know documentation cannot cover every use case. Our community Discord has Rach Dev LLP engineers actively answering questions. Office hours happen twice a week where you can bring any technical challenge and get live help. We also publish migration guides, best practice documents, and architecture patterns based on what we see working well across our customer base.`,
    benefits: [
      "Real engineers respond to every support request — under 4 hours on Growth, under 1 hour on Scale",
      "Custom integration development included on Growth and Scale plans",
      "Database migration assistance: schema, data transfer, and connection string updates handled for you",
      "Architecture reviews before launch covering schema, RLS, agent config, and deployment",
      "Active community Discord with Rach Dev LLP engineers answering questions daily",
      "Twice-weekly office hours for live technical help on any challenge",
    ],
    relatedFeatures: [
      "dedicated-infrastructure",
      "managed-postgresql",
      "agent-templates",
    ],
  },
  {
    id: 16,
    slug: "analytics-dashboard",
    name: "Analytics Dashboard",
    icon: "BarChart3",
    category: "platform",
    shortDescription:
      "Track agent impressions, conversation volume, resolution rates, escalation frequency, and ROI across all your deployed agents in a single dashboard.",
    fullDescription: `Deploying an AI agent without analytics is like running ads without conversion tracking — you are spending money but have no idea if it is working. Rach Dev LLP's analytics dashboard gives you complete visibility into how your agents are performing, from high-level business metrics to granular conversation-level details.

The dashboard tracks key metrics in real time: total conversations, resolution rate (conversations handled without human escalation), average conversation duration, customer satisfaction scores (via post-conversation surveys), and estimated cost savings (based on the number of conversations your agents handle that would otherwise require a human). You can filter by agent, by time period, and by customer segment to understand performance across different contexts.

Conversation-level analytics let you drill into individual interactions. See which conversations were resolved successfully, which were escalated, and which were abandoned. Flag conversations for review, annotate them with notes, and use them as training examples to improve your agent. Escalation analytics show the most common reasons for human handoff, which directly informs what to configure next. Export data via API for integration with your BI tools, or set up automated reports delivered weekly to your inbox.`,
    benefits: [
      "Real-time metrics: conversations, resolution rate, duration, satisfaction, and cost savings",
      "Filter by agent, time period, and customer segment for granular performance analysis",
      "Conversation-level drill-down with flagging, annotation, and training example extraction",
      "Escalation analytics revealing common handoff reasons for targeted agent improvement",
      "API export for integration with external BI tools like Looker, Tableau, or Metabase",
      "Automated weekly reports delivered to your inbox with key performance trends",
    ],
    relatedFeatures: [
      "human-escalation",
      "one-click-deploy",
      "dedicated-infrastructure",
    ],
  },
];
