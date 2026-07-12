export interface Tenant {
  id: string;
  name: string;
  primaryContact: string;
  contactEmail: string;
  plan: "Starter" | "Growth" | "Scale" | "Enterprise";
  status: "active" | "trial" | "suspended" | "deleted";
  mrr: number;
  region: string;
  createdAt: string;
  lastActive: string;
  projectCount: number;
  agentCount: number;
  usagePercent: number;
}

export const mockTenants: Tenant[] = [
  { id: "ten_1", name: "Acme Corp", primaryContact: "John Smith", contactEmail: "john@acme.com", plan: "Scale", status: "active", mrr: 199, region: "US East", createdAt: "2025-10-01", lastActive: "2026-04-27", projectCount: 3, agentCount: 8, usagePercent: 72 },
  { id: "ten_2", name: "TechStart Inc", primaryContact: "Lisa Wang", contactEmail: "lisa@techstart.io", plan: "Growth", status: "active", mrr: 79, region: "US East", createdAt: "2025-11-15", lastActive: "2026-04-27", projectCount: 2, agentCount: 4, usagePercent: 45 },
  { id: "ten_3", name: "MedFlow", primaryContact: "Dr. Patel", contactEmail: "patel@medflow.com", plan: "Enterprise", status: "active", mrr: 499, region: "India Mumbai", createdAt: "2025-12-01", lastActive: "2026-04-26", projectCount: 5, agentCount: 15, usagePercent: 88 },
  { id: "ten_4", name: "FreshBake Co", primaryContact: "Maria Garcia", contactEmail: "maria@freshbake.co", plan: "Starter", status: "active", mrr: 29, region: "US East", createdAt: "2026-01-10", lastActive: "2026-04-27", projectCount: 1, agentCount: 2, usagePercent: 30 },
  { id: "ten_5", name: "NovaTech", primaryContact: "Alex Kim", contactEmail: "alex@novatech.dev", plan: "Growth", status: "trial", mrr: 0, region: "US East", createdAt: "2026-04-15", lastActive: "2026-04-26", projectCount: 1, agentCount: 1, usagePercent: 10 },
  { id: "ten_6", name: "CloudFirst", primaryContact: "Sam Lee", contactEmail: "sam@cloudfirst.io", plan: "Scale", status: "active", mrr: 199, region: "US East", createdAt: "2025-09-20", lastActive: "2026-04-27", projectCount: 4, agentCount: 12, usagePercent: 65 },
  { id: "ten_7", name: "DataDriven", primaryContact: "Emily Chen", contactEmail: "emily@datadriven.co", plan: "Growth", status: "suspended", mrr: 0, region: "India Mumbai", createdAt: "2025-11-01", lastActive: "2026-03-15", projectCount: 2, agentCount: 3, usagePercent: 0 },
  { id: "ten_8", name: "RetailMax", primaryContact: "Tom Brown", contactEmail: "tom@retailmax.com", plan: "Enterprise", status: "active", mrr: 499, region: "US East", createdAt: "2025-08-15", lastActive: "2026-04-27", projectCount: 6, agentCount: 20, usagePercent: 78 },
];

export const mockAdminStats = {
  totalMrr: 1584,
  mrrGrowth: 12.5,
  activeTenants: 6,
  newTenantsThisMonth: 2,
  totalAgents: 65,
  totalInteractions: 48_320,
  platformUptime: 99.98,
};

export const mockMrrTrend = [
  { month: "May '25", mrr: 580 },
  { month: "Jun '25", mrr: 650 },
  { month: "Jul '25", mrr: 720 },
  { month: "Aug '25", mrr: 850 },
  { month: "Sep '25", mrr: 920 },
  { month: "Oct '25", mrr: 1050 },
  { month: "Nov '25", mrr: 1100 },
  { month: "Dec '25", mrr: 1200 },
  { month: "Jan '26", mrr: 1280 },
  { month: "Feb '26", mrr: 1350 },
  { month: "Mar '26", mrr: 1420 },
  { month: "Apr '26", mrr: 1584 },
];
