import Image from "next/image";
import { LayoutPanelTop, ShieldCheck, Wrench } from "lucide-react";
import { AnimateIn } from '../ui/AnimateIn';
import { HomeSectionHead } from "./HomeSectionHead";

const ROWS = [
  {
    icon: LayoutPanelTop,
    title: "Your infrastructure, our problem",
    desc: "Every project runs on dedicated infrastructure — your own database, storage, and namespace. No shared resources, no noisy neighbors. Data stays in your chosen region. We handle backups, scaling, monitoring, and security. You handle your product.",
    img: "/illustrations/rach-illus-infrastructure.png",
    alt: "Three isolated tenant namespaces, each with its own database, storage and code",
    flip: false,
  },
  {
    icon: ShieldCheck,
    title: "Agents that actually work in production",
    desc: "We don't generate agents from scratch and hope they work. Our templates are battle-tested with built-in guardrails, compliance checks, and human escalation paths. When the AI doesn't know, it says so — and routes to a real person. That's how you keep customers happy.",
    img: "/illustrations/rach-illus-reliability.png",
    alt: "Decision flow: auto-resolve when possible, escalate to a human when not",
    flip: true,
  },
  {
    icon: Wrench,
    title: "Stuck? Our developers have your back",
    desc: "Unlike every other platform that leaves you alone after signup, Rach Dev LLP has a team of engineers ready to help. Need a custom integration? An agent template modified? A database migration from AWS or Supabase? We'll do it for you. Platform meets agency.",
    img: "/illustrations/rach-illus-dev-support.png",
    alt: "A developer connected to your codebase, ready to help",
    flip: false,
  },
];

export function WhyRachDev() {
  return (
    <section className="bg-band py-24">
      <div className="mx-auto max-w-site px-8">
        <AnimateIn>
          <HomeSectionHead eyebrow="Why Rach Dev LLP" title="We're the team you wish you had" />
        </AnimateIn>

        <div className="mt-[30px]">
          {ROWS.map((row) => {
            const Icon = row.icon;
            return (
              <AnimateIn key={row.title}>
                <div className="grid grid-cols-1 items-center gap-14 py-[38px] min-[960px]:grid-cols-2">
                  <div
                    className={`grid min-h-[300px] place-items-center rounded-[18px] border border-line bg-surface p-6 shadow-well-sm ${
                      row.flip ? "min-[960px]:order-2" : ""
                    }`}
                  >
                    <Image
                      src={row.img}
                      alt={row.alt}
                      width={420}
                      height={420}
                      className="h-auto w-full max-w-[420px]"
                    />
                  </div>
                  <div>
                    <div className="mb-4 grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-accent-weak text-accent">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                    <h3 className="font-display text-[26px] font-bold tracking-[-0.015em]">
                      {row.title}
                    </h3>
                    <p className="mt-[14px] max-w-[440px] text-[16px] leading-[1.65] text-ink-2">
                      {row.desc}
                    </p>
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
