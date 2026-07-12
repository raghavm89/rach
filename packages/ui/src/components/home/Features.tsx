import { Database, ShieldCheck, Code2 } from "lucide-react";
import { AnimateIn } from '../ui/AnimateIn';
import { HomeSectionHead } from "./HomeSectionHead";

const FEATURES = [
  {
    icon: Database,
    title: "Managed PostgreSQL",
    desc: "Dedicated database per project with pgvector for AI-ready search. Automated backups, point-in-time recovery, and connection pooling included.",
  },
  {
    icon: ShieldCheck,
    title: "Authentication",
    desc: "Email, OAuth, and magic-link auth out of the box. Row-level security, JWT tokens, and multi-tenant user management — no Auth0 bills.",
  },
  {
    icon: Code2,
    title: "Auto-Generated APIs",
    desc: "Create a table, get REST and GraphQL endpoints instantly. Filtering, pagination, and realtime subscriptions built in.",
  },
];

export function Features() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <HomeSectionHead
            eyebrow="Features"
            title="Everything you need to ship"
            sub="From database to deployment, every piece of your stack — managed, monitored, and ready to scale."
          />
        </AnimateIn>

        <div className="mt-[54px] grid grid-cols-1 gap-[22px] min-[960px]:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <AnimateIn key={f.title} delay={i * 0.08}>
                <div className="rounded-[16px] border border-line bg-surface p-7 shadow-well-sm">
                  <div className="mb-4 grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-accent-weak text-accent">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <h3 className="font-display text-[18px] font-bold tracking-[-0.01em]">
                    {f.title}
                  </h3>
                  <p className="mt-[9px] text-[14.5px] leading-[1.6] text-ink-2">{f.desc}</p>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
