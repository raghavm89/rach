'use client';

/**
 * "One builder, every kind of agent" — a continuously scrolling strip of the
 * agent types you can build (WhatsApp, voice, video, visual builder, RAG, BYO
 * model, teams, API…). Each card carries a one-line description. Pauses on
 * hover, fades at the edges, and falls back to a static wrapped grid under
 * prefers-reduced-motion. Pure-CSS animation.
 */

import {
  MessageCircle, Phone, Video, Globe, Network, BookOpen,
  Cpu, LayoutTemplate, Plug, Hash, ShieldCheck, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type AgentType = { icon: LucideIcon; title: string; blurb: string };

const TYPES: AgentType[] = [
  { icon: MessageCircle, title: 'WhatsApp agents', blurb: 'Answer customers on WhatsApp, 24/7.' },
  { icon: Phone, title: 'Voice agents', blurb: 'Pick up calls and speak naturally.' },
  { icon: Video, title: 'Video agents', blurb: 'On-screen avatars that talk back.' },
  { icon: Globe, title: 'Website widget', blurb: 'Embed a chat bubble in one line.' },
  { icon: Network, title: 'Multi-agent teams', blurb: 'A conductor routing to specialists.' },
  { icon: BookOpen, title: 'RAG assistants', blurb: 'Grounded answers from your knowledge base.' },
  { icon: Cpu, title: 'Any LLM', blurb: 'Claude, GPT-4o, Llama — bring your own.' },
  { icon: LayoutTemplate, title: 'Visual builder', blurb: 'Design on a drag-and-drop canvas.' },
  { icon: Plug, title: 'API agents', blurb: 'OpenAI-compatible /v1 endpoint.' },
  { icon: Hash, title: 'Slack agents', blurb: 'Answer right inside your workspace.' },
  { icon: ShieldCheck, title: 'Guardrailed', blurb: 'Grounding + human handoff, built in.' },
  { icon: Sparkles, title: 'AI assistants', blurb: 'Task copilots for any workflow.' },
];

function TypeCard({ t }: { t: AgentType }) {
  const Icon = t.icon;
  return (
    <div className="flex min-w-[248px] max-w-[248px] items-start gap-3 rounded-2xl border border-ink/10 bg-page p-4 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-weak text-accent">
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{t.title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{t.blurb}</span>
      </span>
    </div>
  );
}

export function AgentTypesMarquee() {
  const loop = [...TYPES, ...TYPES];
  return (
    <div
      className="atq-wrap relative overflow-hidden py-1"
      style={{
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)',
      }}
    >
      <div className="atq flex w-max gap-4">
        {loop.map((t, i) => (
          <div key={`${t.title}-${i}`} aria-hidden={i >= TYPES.length}>
            <TypeCard t={t} />
          </div>
        ))}
      </div>

      <style>{`
        .atq { animation: atq-scroll 60s linear infinite; }
        .atq-wrap:hover .atq { animation-play-state: paused; }
        @keyframes atq-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .atq { animation: none; width: 100%; flex-wrap: wrap; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
