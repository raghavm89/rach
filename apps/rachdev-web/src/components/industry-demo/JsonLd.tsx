import type { IndustryConfig } from "@/lib/industries/types";

const BASE = "https://rach.dev";

/**
 * Structured data for AEO / GEO: BreadcrumbList + FAQPage + SoftwareApplication.
 * Server component — emits a single application/ld+json script.
 */
export function JsonLd({ config }: { config: IndustryConfig }) {
  const url = `${BASE}/agents/${config.slug}`;
  const faqs =
    config.faq && config.faq.length > 0
      ? config.faq
      : config.knowledge.map((k) => ({ q: k.q, a: k.a }));

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "Agents", item: `${BASE}/agents/${config.slug}` },
      { "@type": "ListItem", position: 3, name: `${config.vertical} Agents`, item: url },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `Rach.Dev — ${config.vertical} Operations Layer`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url,
    description: config.seoDescription,
    publisher: { "@type": "Organization", name: "Rach Dev LLP", url: BASE },
    offers: { "@type": "Offer", availability: "https://schema.org/InStock", price: "0", priceCurrency: "USD" },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumb, faqPage, software]) }}
    />
  );
}
