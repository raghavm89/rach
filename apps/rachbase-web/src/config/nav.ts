// RachBase (cloud side) navigation — no agent-builder links.
// Passed into the shared @rach/ui Navbar/Footer so the design is shared but the
// content is brand-specific.

export const navGroups = [
  {
    label: "Product",
    links: [
      { label: "BaaS Platform", href: "/products/baas" },
      { label: "Integrations", href: "/integrations" },
    ],
  },
  {
    label: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    label: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "BaaS Platform", href: "/products/baas" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Security", href: "/security" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Legal", href: "/legal/privacy" },
    ],
  },
];

export const footerTagline = "Your backend, managed.";
