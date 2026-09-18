import type { Metadata } from "next";
import { SectionWrapper } from "@rach/ui/components/ui/SectionWrapper";
import StatusClient from "./StatusClient";

export const metadata: Metadata = {
  title: "System Status",
  description:
    "Live status and uptime history for RachBase — control plane, managed Postgres, deploy pipeline, and regions. Backed by our 99.95% uptime SLA.",
};

export default function StatusPage() {
  return (
    <SectionWrapper>
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-black sm:text-4xl">System Status</h1>
          <p className="mt-2 text-ink-2">
            Live health of the RachBase platform. Backed by our{" "}
            <a href="/legal/sla" className="text-accent underline underline-offset-2 hover:opacity-80">
              99.95% uptime SLA
            </a>.
          </p>
        </header>
        <StatusClient />
      </div>
    </SectionWrapper>
  );
}
