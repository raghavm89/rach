import { Breadcrumb } from '@rach/ui/components/ui/Breadcrumb';
import type { IndustryConfig } from "@/lib/industries/types";
import { Hero } from "./Hero";
import { OperatingPicture } from "./OperatingPicture";
import { ControlTower } from "./ControlTower";
import { AgentRoster } from "./AgentRoster";
import { Architecture } from "./Architecture";
import { KnowledgeDemo } from "./KnowledgeDemo";
import { Governance } from "./Governance";
import { Spotlight } from "./Spotlight";
import { Outcomes } from "./Outcomes";
import { CtaBand } from "./CtaBand";

/** Server composer — renders the whole industry demo from a single config. */
export function IndustryDemo({ config }: { config: IndustryConfig }) {
  const crumbs = [
    { label: "Home", href: "/" },
    { label: "Industries", href: "/industries" },
    ...(config.industrySlug && config.industryName
      ? [{ label: config.industryName, href: `/industries/${config.industrySlug}` }]
      : []),
    { label: `${config.vertical} Agents` },
  ];

  return (
    <>
      <div className="mx-auto max-w-site px-8 pt-8">
        <Breadcrumb items={crumbs} />
      </div>

      <Hero config={config} />
      <OperatingPicture config={config} />
      <ControlTower config={config} />
      <AgentRoster config={config} />
      <Architecture config={config} />
      <KnowledgeDemo config={config} />
      <Governance config={config} />
      <Spotlight config={config} />
      <Outcomes config={config} />
      <CtaBand config={config} />
    </>
  );
}
