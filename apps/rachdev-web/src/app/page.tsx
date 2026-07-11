import {
  SectionHeader,
  GradientText,
  Button,
  Card,
  Badge,
  StatBlock,
} from "@rach/ui";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-page text-ink">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-16 text-center">
        <Badge>AI Agent Builder</Badge>
        <h1 className="mt-6 text-5xl font-display font-extrabold tracking-tight">
          Build agents that <GradientText>do real work</GradientText>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
          RachDev lets you design, run, and deploy autonomous AI agents — running
          on managed infrastructure by RachBase.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button href="/demo">Try the demo</Button>
          <Button href="/products/agent-builder">Learn more</Button>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatBlock value="60+" label="Agent templates" />
          <StatBlock value="15" label="Industries" />
          <StatBlock value="<90s" label="Deploy time" />
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="How it works"
          title="From prompt to production"
          subtitle="Everything you need to ship an agent, on one platform."
          centered
        />
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card hoverLift>
            <h3 className="text-lg font-semibold">Build</h3>
            <p className="mt-2 text-text-secondary">
              Compose agents from templates, tools, and your own prompts.
            </p>
          </Card>
          <Card hoverLift>
            <h3 className="text-lg font-semibold">Run</h3>
            <p className="mt-2 text-text-secondary">
              Credit-metered model calls through one gateway, any provider.
            </p>
          </Card>
          <Card hoverLift>
            <h3 className="text-lg font-semibold">Deploy</h3>
            <p className="mt-2 text-text-secondary">
              Ship to managed containers provisioned by RachBase.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
