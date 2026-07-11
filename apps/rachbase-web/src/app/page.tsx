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
        <Badge>Cloud Management · BaaS</Badge>
        <h1 className="mt-6 text-5xl font-display font-extrabold tracking-tight">
          Your backend, <GradientText>managed</GradientText>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-secondary">
          RachBase provisions, deploys, and monitors your infrastructure — VMs,
          containers, and databases — so you ship product, not plumbing.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button href="/dashboard">Open dashboard</Button>
          <Button href="/products/baas">See pricing</Button>
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <StatBlock value="VMs" label="Provisioned on Proxmox" />
          <StatBlock value="24/7" label="Monitoring & alerts" />
          <StatBlock value="1-click" label="Deploy from GitHub" />
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <SectionHeader
          eyebrow="What you get"
          title="One control plane for your cloud"
          subtitle="Compute, deployments, monitoring, tenants, and billing."
          centered
        />
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card hoverLift>
            <h3 className="text-lg font-semibold">Provision</h3>
            <p className="mt-2 text-text-secondary">
              VMs and containers, assigned per tenant, expandable on demand.
            </p>
          </Card>
          <Card hoverLift>
            <h3 className="text-lg font-semibold">Deploy</h3>
            <p className="mt-2 text-text-secondary">
              GitHub-driven pipelines with secure SSH command execution.
            </p>
          </Card>
          <Card hoverLift>
            <h3 className="text-lg font-semibold">Monitor</h3>
            <p className="mt-2 text-text-secondary">
              Real-time metrics and alerting, backed by Prometheus.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
