// RachDev (agent side) navigation — no cloud/BaaS links.
// Passed into the shared @rach/ui Navbar/Footer so the design is shared but the
// content is brand-specific.

export const navGroups = [
  {
    label: "Product",
    links: [
      { label: "Agent Builder", href: "/products/agent-builder" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
  {
    label: "Solutions",
    links: [
      { label: "AI Agents", href: "/agents" },
      { label: "By Industry", href: "/industries" },
      { label: "Templates Library", href: "/templates" },
    ],
  },
  {
    label: "Resources",
    links: [
      // Documentation hidden until /docs ships real content (currently "Coming soon").
      { label: "Security", href: "/security" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Agent Builder", href: "/products/agent-builder" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "/features" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "By Industry", href: "/industries" },
      { label: "Templates", href: "/templates" },
    ],
  },
  {
    title: "Resources",
    links: [
      // Documentation hidden until /docs ships real content (currently "Coming soon").
      { label: "Security", href: "/security" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
      { label: "Legal", href: "/legal/privacy" },
    ],
  },
];

export const footerTagline = "Deploy intelligent AI agents in minutes.";
