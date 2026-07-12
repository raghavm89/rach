"use client";

import { useState } from "react";
import { BookOpen, ShieldCheck, UserCheck, Sparkles, ToggleLeft, ToggleRight } from "lucide-react";
import { DemoChat } from "@/components/demo/DemoChat";
import { GradientText } from '@rach/ui/components/ui/GradientText';
import { Badge } from '@rach/ui/components/ui/Badge';
import { ariaDemo } from "@/data/demo/support-aria";

const capabilities = [
  { icon: BookOpen, color: "text-purple-600", title: "Answers from knowledge", hint: 'Try "Track my order" or "Sizing help".' },
  { icon: ShieldCheck, color: "text-blue-600", title: "Stays on topic (guardrails)", hint: 'Try "Ask something off-topic".' },
  { icon: UserCheck, color: "text-amber-600", title: "Escalates to a human", hint: 'Try "Item arrived damaged".' },
  { icon: Sparkles, color: "text-pink-600", title: "Owner customization", hint: "Toggle the rule, then start a return." },
];

export default function DemoPage() {
  const [ownerRuleActive, setOwnerRuleActive] = useState(false);

  return (
    <section className="dot-pattern pt-28 pb-20 lg:pt-32">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: explainer */}
          <div>
            <Badge className="mb-5">
              <span className="mr-1">&#10022;</span>
              Interactive preview
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Meet <GradientText>Aria</GradientText>, a support agent for an online store.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-secondary">
              This is a scripted preview of how a Rach.Dev agent behaves — no live model
              is called. Click a prompt and watch how Aria handles real support moments.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {capabilities.map((c) => (
                <div key={c.title} className="rounded-xl border border-neutral-border bg-white p-4">
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                  <p className="mt-2 text-sm font-semibold text-text-primary">{c.title}</p>
                  <p className="mt-1 text-xs text-text-muted">{c.hint}</p>
                </div>
              ))}
            </div>

            {/* "Make it yours" owner-rule toggle */}
            <button
              onClick={() => setOwnerRuleActive((v) => !v)}
              className="mt-6 flex w-full items-center gap-3 rounded-xl border border-neutral-border bg-bg-secondary p-4 text-left transition-colors hover:border-primary-blue"
            >
              {ownerRuleActive ? (
                <ToggleRight className="h-6 w-6 shrink-0 text-primary-blue" />
              ) : (
                <ToggleLeft className="h-6 w-6 shrink-0 text-text-muted" />
              )}
              <span>
                <span className="block text-sm font-semibold text-text-primary">
                  Owner rule: {ariaDemo.ownerRule.label}
                </span>
                <span className="block text-xs text-text-muted">{ariaDemo.ownerRule.description}</span>
              </span>
            </button>
          </div>

          {/* Right: the scripted chat */}
          <div className="lg:sticky lg:top-28">
            <DemoChat demo={ariaDemo} ownerRuleActive={ownerRuleActive} className="h-[600px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
