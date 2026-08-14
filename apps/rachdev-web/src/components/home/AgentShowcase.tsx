'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';

/**
 * Live product showcase for the "Design your agent team" section.
 * A browser-framed window that auto-cycles through the real product screenshots
 * every few seconds (crossfade), with an animated Design → Connect → Test →
 * Deploy strip whose highlight travels left-to-right. Pauses on hover and
 * honours prefers-reduced-motion.
 */

const SLIDES = [
  {
    src: '/images/showcase/team-canvas.png',
    alt: 'Agent team canvas — a conductor routing a website channel to a specialist and human handoff',
    title: 'Visual team canvas',
    caption: 'Drag in a conductor, specialists, tools, and human handoff — connect them into a flow.',
  },
  {
    src: '/images/showcase/connections.png',
    alt: 'Connections — channels and tools your agents can use',
    title: 'Your channels & tools',
    caption: 'Connect Slack, WhatsApp, Razorpay, Stripe, Shopify, and more — credentials encrypted at rest.',
  },
];

const STEPS = ['Design', 'Connect', 'Test', 'Deploy'];
const SLIDE_MS = 3200;
const STEP_MS = 1200;

export function AgentShowcase() {
  const [slide, setSlide] = useState(0);
  const [step, setStep] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const slideTimer = setInterval(() => { if (!paused.current) setSlide((s) => (s + 1) % SLIDES.length); }, SLIDE_MS);
    const stepTimer = setInterval(() => { if (!paused.current) setStep((s) => (s + 1) % STEPS.length); }, STEP_MS);
    return () => { clearInterval(slideTimer); clearInterval(stepTimer); };
  }, []);

  const active = SLIDES[slide];

  return (
    <div
      className="mx-auto max-w-3xl"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      {/* Steps — highlight travels left → right */}
      <div className="mb-6 flex items-center justify-center gap-1.5 sm:gap-3">
        {STEPS.map((label, i) => {
          const done = i < step;
          const on = i === step;
          return (
            <div key={label} className="flex items-center gap-1.5 sm:gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-500 ${
                  on
                    ? 'border-accent bg-accent text-white shadow-sm scale-105'
                    : done
                      ? 'border-accent/30 bg-accent-weak text-accent'
                      : 'border-ink/10 bg-page text-ink-2'
                }`}
              >
                {done && <Check size={12} />} {label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="relative h-0.5 w-5 overflow-hidden rounded-full bg-ink/10 sm:w-10">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full bg-accent transition-all duration-500 ${
                      i < step ? 'w-full' : 'w-0'
                    }`}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Window */}
      <figure className="overflow-hidden rounded-2xl border border-ink/10 bg-ink shadow-xl ring-1 ring-black/5">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          <span className="ml-3 truncate text-[11px] font-medium text-white/50">rachdev.com / dashboard</span>
        </div>

        <div className="relative w-full bg-ink" style={{ aspectRatio: '16 / 10' }}>
          {SLIDES.map((s, i) => (
            <Image
              key={s.src}
              src={s.src}
              alt={s.alt}
              fill
              sizes="(min-width: 1024px) 768px, 100vw"
              priority={i === 0}
              className={`object-contain transition-opacity duration-700 ease-in-out ${
                i === slide ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
        </div>

        <figcaption className="border-t border-ink/10 bg-page px-5 py-3 text-sm text-ink-2">
          <span className="font-semibold text-ink">{active.title}.</span> {active.caption}
        </figcaption>
      </figure>

      {/* Dots */}
      <div className="mt-4 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            onClick={() => setSlide(i)}
            aria-label={`Show ${s.title}`}
            aria-current={i === slide}
            className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-accent' : 'w-2 bg-ink/20 hover:bg-ink/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
