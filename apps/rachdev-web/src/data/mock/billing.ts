export interface PlanInfo {
  name: string;
  price: number;
  renewalDate: string;
  limits: {
    apiCalls: number;
    dbSizeGb: number;
    storageGb: number;
    agentInteractions: number;
  };
}

export interface UsageData {
  apiCalls: { current: number; limit: number };
  dbSize: { currentGb: number; limitGb: number };
  storage: { currentGb: number; limitGb: number };
  agentInteractions: { current: number; limit: number };
}

export interface Invoice {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  pdfUrl: string;
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

export const mockPlan: PlanInfo = {
  name: "Growth",
  price: 79,
  renewalDate: "2026-05-15",
  limits: {
    apiCalls: 500_000,
    dbSizeGb: 25,
    storageGb: 50,
    agentInteractions: 10_000,
  },
};

export const mockUsage: UsageData = {
  apiCalls: { current: 387_420, limit: 500_000 },
  dbSize: { currentGb: 8.2, limitGb: 25 },
  storage: { currentGb: 12.4, limitGb: 50 },
  agentInteractions: { current: 2_643, limit: 10_000 },
};

export const mockProjectedCost = {
  base: 79,
  projectedOverage: 12,
  total: 91,
};

export const mockInvoices: Invoice[] = [
  { id: "inv_1", number: "INV-2026-0004", date: "2026-04-01", amount: 79, status: "paid", pdfUrl: "#" },
  { id: "inv_2", number: "INV-2026-0003", date: "2026-03-01", amount: 79, status: "paid", pdfUrl: "#" },
  { id: "inv_3", number: "INV-2026-0002", date: "2026-02-01", amount: 85, status: "paid", pdfUrl: "#" },
  { id: "inv_4", number: "INV-2026-0001", date: "2026-01-01", amount: 79, status: "paid", pdfUrl: "#" },
  { id: "inv_5", number: "INV-2025-0012", date: "2025-12-01", amount: 79, status: "paid", pdfUrl: "#" },
];

export const mockPaymentMethods: PaymentMethod[] = [
  { id: "pm_1", brand: "Visa", last4: "4242", expiry: "12/27", isDefault: true },
  { id: "pm_2", brand: "Mastercard", last4: "8888", expiry: "06/28", isDefault: false },
];

export const mockUsageByDay = Array.from({ length: 30 }, (_, i) => ({
  date: `Apr ${i + 1}`,
  apiCalls: Math.floor(10000 + Math.random() * 5000),
  agentInteractions: Math.floor(50 + Math.random() * 100),
  storageGb: +(12 + Math.random() * 0.5).toFixed(2),
}));
