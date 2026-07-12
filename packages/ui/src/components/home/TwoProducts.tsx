import Image from "next/image";
import { Database, Bot } from "lucide-react";
import { AnimateIn } from '../ui/AnimateIn';
import { HomeSectionHead } from "./HomeSectionHead";

const PRODUCTS = [
  {
    icon: Database,
    kicker: "Backend as a Service",
    title: "Infrastructure that just works",
    desc: "Managed PostgreSQL, authentication, object storage, and auto-generated APIs. Your data stays on secure, dedicated infrastructure — India and US regions. Zero DevOps.",
    img: "/illustrations/rach-illus-baas-stack.png",
    alt: "Backend stack: Database, Auth, Storage and APIs layers",
    tags: ["Database", "Auth", "Storage", "APIs", "Realtime"],
  },
  {
    icon: Bot,
    kicker: "AI Agent Builder",
    title: "Deploy intelligent agents in minutes",
    desc: "Production-tested templates across 15 industries. Customize through conversation. Deploy with one click onto the same infrastructure that powers your backend.",
    img: "/illustrations/rach-illus-agent-hub.png",
    alt: "AI agent connected to chat, calendar, analytics, database and documents",
    tags: ["Templates", "Sandbox", "One-Click Deploy", "Human Escalation"],
  },
];

export function TwoProducts() {
  return (
    <section className="bg-band py-24">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <HomeSectionHead
            eyebrow="Platform"
            title="Two products. One platform."
            sub="A complete backend-as-a-service suite and an AI agent builder — connected seamlessly so you go from idea to production in hours, not months."
          />
        </AnimateIn>

        <div className="mt-[54px] grid grid-cols-1 gap-7 min-[960px]:grid-cols-2">
          {PRODUCTS.map((p, i) => {
            const Icon = p.icon;
            return (
              <AnimateIn key={p.title} delay={i * 0.1}>
                <div className="rounded-[20px] border border-line bg-surface p-[34px] shadow-well-sm">
                  <div className="mb-[18px] grid h-10 w-10 place-items-center rounded-[11px] bg-accent-weak text-accent">
                    <Icon className="h-[21px] w-[21px]" strokeWidth={1.8} />
                  </div>
                  <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-3">
                    {p.kicker}
                  </div>
                  <h3 className="mt-2 font-display text-[24px] font-bold tracking-[-0.015em]">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.6] text-ink-2">{p.desc}</p>
                  <div className="mt-6 grid min-h-[240px] place-items-center rounded-[14px] border border-line bg-band p-[18px]">
                    <Image
                      src={p.img}
                      alt={p.alt}
                      width={320}
                      height={320}
                      className="h-auto w-full max-w-[320px]"
                    />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-accent-line bg-accent-weak px-[11px] py-1 text-[12.5px] text-accent"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
