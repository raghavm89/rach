const MARKS = [
  "SendGrid",
  "PostgreSQL",
  "React",
  "Next.js",
  "OpenAI",
  "Anthropic",
  "Stripe",
  "Twilio",
];

const STATS = [
  { n: "10+", l: "Businesses powered" },
  { n: "99.9%", l: "Uptime" },
  { n: "<90s", l: "Setup" },
];

export function TrustedStrip() {
  return (
    <section className="border-y border-line pb-2 pt-[14px]">
      <div className="mx-auto max-w-site px-8">
        <div className="mb-[22px] text-center text-[13px] text-ink-3">
          Trusted by founders building with
        </div>
        <div className="flex flex-wrap justify-center gap-x-[44px] gap-y-[14px]">
          {MARKS.map((m) => (
            <span
              key={m}
              className="text-[17px] font-semibold tracking-[-0.01em] text-[#C2C2BC]"
            >
              {m}
            </span>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-x-16 gap-y-6">
          {STATS.map((s) => (
            <div key={s.l} className="text-center">
              <div className="font-display text-[34px] font-bold tracking-[-0.02em]">
                {s.n}
              </div>
              <div className="mt-1 text-[13.5px] text-ink-2">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
