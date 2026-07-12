const logos = [
  { name: "PostgreSQL", color: "#336791" },
  { name: "React", color: "#61DAFB" },
  { name: "Next.js", color: "#000000" },
  { name: "OpenAI", color: "#10A37F" },
  { name: "Anthropic", color: "#D4A574" },
  { name: "Stripe", color: "#635BFF" },
  { name: "Twilio", color: "#F22F46" },
  { name: "SendGrid", color: "#1A82E2" },
];

export function LogoTicker() {
  return (
    <section className="border-y border-neutral-border bg-bg-secondary py-8">
      <p className="mb-6 text-center text-sm font-medium text-text-muted">
        Trusted by founders building with
      </p>
      <div className="overflow-hidden">
        <div className="animate-marquee flex w-max items-center gap-16">
          {[...logos, ...logos].map((logo, i) => (
            <span
              key={i}
              className="whitespace-nowrap font-display text-lg font-semibold text-text-muted/50 transition-colors duration-300 hover:text-text-primary"
              style={{
                // @ts-expect-error CSS custom property
                "--hover-color": logo.color,
              }}
            >
              {logo.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
