import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIndustry, industrySlugs } from "@/lib/industries";
import { IndustryDemo } from "@/components/industry-demo/IndustryDemo";
import { JsonLd } from "@/components/industry-demo/JsonLd";

interface AgentPageProps {
  params: { industry: string };
}

export function generateStaticParams() {
  return industrySlugs.map((industry) => ({ industry }));
}

export function generateMetadata({ params }: AgentPageProps): Metadata {
  const config = getIndustry(params.industry);
  if (!config) return {};

  const url = `https://rach.dev/agents/${config.slug}`;
  return {
    title: config.seoTitle,
    description: config.seoDescription,
    keywords: config.seoKeywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${config.seoTitle} | Rach Dev LLP`,
      description: config.seoDescription,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: config.seoTitle,
      description: config.seoDescription,
    },
  };
}

export default function AgentIndustryPage({ params }: AgentPageProps) {
  const config = getIndustry(params.industry);
  if (!config) notFound();

  return (
    <>
      <JsonLd config={config} />
      <IndustryDemo config={config} />
    </>
  );
}
