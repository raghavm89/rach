export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  image?: string;
}

export const team: TeamMember[] = [
  {
    name: "Raghav",
    role: "Co-Founder & CEO",
    bio: "Raghav drives the business strategy, go-to-market, and customer relationships at Rach Dev LLP. With a background in enterprise sales and product management across SaaS and fintech, he identified the gap between businesses that want to deploy AI agents and the fragmented infrastructure required to make them production-ready. He leads partnerships with industry-specific customers, shapes the template library based on real deployment feedback, and ensures every feature ships with a clear path to revenue for the businesses using the platform. Raghav's focus is on making AI agent deployment accessible to companies that lack dedicated ML engineering teams — turning a multi-month technical project into something that launches in an afternoon.",
  },
  {
    name: "Eshan",
    role: "Co-Founder & CTO",
    bio: "Eshan architects and builds the core platform at Rach Dev LLP — from the managed PostgreSQL infrastructure and auto-generated APIs to the agent runtime and deployment pipeline. A full-stack engineer with deep experience in TypeScript, Next.js, PostgreSQL, and cloud infrastructure, he designed the dedicated-tenant architecture that gives every customer isolated resources without the operational overhead of managing their own servers. Before Rach Dev LLP, he built production systems spanning mobile apps, backend services, and developer tooling. Eshan's engineering philosophy is that infrastructure should disappear — developers and businesses should think about what their agents do, not how they are hosted, scaled, or secured.",
  },
  {
    name: "Tinkle",
    role: "Chief AI Officer (CAIO)",
    bio: "Tinkle leads AI agent building at Rach Dev LLP, bringing over 10 years of industry experience designing, training, and deploying production AI systems. She has built conversational and task-driven agents across sectors — from customer support and healthcare to commerce and operations — and knows first-hand what separates a demo from an agent that holds up in production. At Rach Dev she shapes the agent runtime, curates and tunes the template library across 15 industries, and sets the guardrails, evaluation, and prompting standards that every deployed agent follows. Her focus is making agents that are reliable, safe, and genuinely useful — turning a decade of hands-on agent-building into a platform any team can deploy on in an afternoon.",
  },
];
