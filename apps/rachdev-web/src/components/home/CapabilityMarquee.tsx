'use client';

/**
 * Moving pill marquees for the "More than a chatbot" section. Each row scrolls
 * continuously (opposite directions for visual life), pauses on hover, fades at
 * the edges, and falls back to a static wrapped layout under
 * prefers-reduced-motion. Pure CSS animation — no JS timers.
 */

type Variant = 'ink' | 'accent';

function pillClass(variant: Variant) {
  return variant === 'accent'
    ? 'rounded-full bg-accent-weak px-3.5 py-1.5 text-sm font-medium text-accent whitespace-nowrap'
    : 'rounded-full border border-ink/10 bg-page px-3.5 py-1.5 text-sm font-medium text-ink-2 whitespace-nowrap';
}

function Row({ items, variant = 'ink', reverse = false, durationSec = 42 }: {
  items: string[]; variant?: Variant; reverse?: boolean; durationSec?: number;
}) {
  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = [...items, ...items];
  return (
    <div
      className="rd-mq-wrap relative overflow-hidden py-1.5"
      style={{
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
        maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
      }}
    >
      <div
        className={`rd-mq flex w-max gap-2.5 ${reverse ? 'rd-mq--rev' : ''}`}
        style={{ animationDuration: `${durationSec}s` }}
      >
        {loop.map((label, i) => (
          <span key={`${label}-${i}`} className={pillClass(variant)} aria-hidden={i >= items.length}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CapabilityMarquee({ capabilities, tools }: { capabilities: string[]; tools: string[] }) {
  // Split capabilities across two counter-scrolling rows.
  const mid = Math.ceil(capabilities.length / 2);
  const rowA = capabilities.slice(0, mid);
  const rowB = capabilities.slice(mid);

  return (
    <div>
      <div className="mt-8 space-y-3">
        <Row items={rowA} variant="ink" durationSec={46} />
        <Row items={rowB} variant="ink" reverse durationSec={52} />
      </div>

      <p className="mt-10 text-center text-xs font-semibold uppercase tracking-wider text-ink-2">
        Channels &amp; tools your agents can use
      </p>
      <div className="mt-4">
        <Row items={tools} variant="accent" durationSec={38} />
      </div>

      <style>{`
        .rd-mq { animation-name: rd-mq-left; animation-timing-function: linear; animation-iteration-count: infinite; }
        .rd-mq--rev { animation-name: rd-mq-right; }
        .rd-mq-wrap:hover .rd-mq { animation-play-state: paused; }
        @keyframes rd-mq-left  { from { transform: translateX(0); }      to { transform: translateX(-50%); } }
        @keyframes rd-mq-right { from { transform: translateX(-50%); }   to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) {
          .rd-mq { animation: none; width: 100%; flex-wrap: wrap; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
