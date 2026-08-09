export interface FAQ {
  question: string;
  answer: string;
}

// Contact-sales model: no published prices. Every engagement is scoped and quoted.
export const pricingFAQs: FAQ[] = [
  {
    question: "How is RachDev priced?",
    answer:
      "We don't publish fixed prices. Every deployment is scoped to your workspace — the number of agents and people using them, your expected volume, and where it runs (our cloud or on-prem). We put together a plan and a quote tailored to exactly that. Talk to us and we'll walk you through it.",
  },
  {
    question: "Why isn't there a public price list?",
    answer:
      "AI agent deployments vary widely — a single support agent and a full multi-agent industry solution have very different footprints. Rather than force you into a tier that doesn't fit, we scope the solution with you and quote for what you actually need.",
  },
  {
    question: "Can I run RachDev on-premises?",
    answer:
      "Yes. RachDev can run in our managed cloud or entirely inside your own environment (on-prem or your own cloud), so sensitive data never leaves your premises. On-prem is part of our enterprise engagements — mention it when you reach out and we'll scope it with you.",
  },
  {
    question: "Do you work with teams of our size?",
    answer:
      "We work with organisations across industries — from focused single-agent rollouts to enterprise-wide solutions. Reach out and we'll tell you honestly whether we're a fit and what an engagement would look like.",
  },
  {
    question: "What happens after I get in touch?",
    answer:
      "A short conversation to understand your use case and constraints, a scoped proposal with the agents and workspace we'd deploy, and a tailored quote — no obligation and no generic sales pitch.",
  },
];
