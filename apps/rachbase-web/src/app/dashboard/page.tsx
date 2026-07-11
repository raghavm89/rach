import { SectionHeader, Card, StatBlock, Badge } from "@rach/ui";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <SectionHeader title="Overview" subtitle="Your infrastructure at a glance." />
        <Badge>RachBase</Badge>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatBlock value="—" label="Active VMs" />
        <StatBlock value="—" label="Containers" />
        <StatBlock value="—" label="Deployments today" />
        <StatBlock value="—" label="Open alerts" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <h3 className="text-lg font-semibold">Infrastructure</h3>
          <p className="mt-2 text-text-secondary">VMs, containers, tenant pools.</p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">Deployments</h3>
          <p className="mt-2 text-text-secondary">GitHub-connected services + logs.</p>
        </Card>
        <Card>
          <h3 className="text-lg font-semibold">Monitoring</h3>
          <p className="mt-2 text-text-secondary">Metrics, uptime, and alerts.</p>
        </Card>
      </div>

      <p className="mt-8 text-sm text-text-muted">
        Dashboard modules (my-vms, monitoring, tenants, billing, credit-usage)
        migrate into this shell incrementally.
      </p>
    </main>
  );
}
