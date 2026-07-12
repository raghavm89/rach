export interface ServiceHealth {
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  errorRate: number;
  lastIncident?: string;
}

export interface PerformancePoint {
  time: string;
  requestRate: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}

export interface ResourceUtilization {
  label: string;
  current: number;
  max: number;
  unit: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  status: "active" | "muted";
  lastTriggered?: string;
}

export const mockServiceHealth: ServiceHealth[] = [
  { name: "API Gateway", status: "healthy", latencyMs: 12, errorRate: 0.02 },
  { name: "Database Cluster", status: "healthy", latencyMs: 4, errorRate: 0.01 },
  { name: "Agent Runtime", status: "healthy", latencyMs: 45, errorRate: 0.05 },
  { name: "Object Storage", status: "healthy", latencyMs: 18, errorRate: 0 },
  { name: "Auth Service", status: "healthy", latencyMs: 8, errorRate: 0.01 },
  { name: "LLM Proxy", status: "degraded", latencyMs: 320, errorRate: 1.2, lastIncident: "2026-04-26T14:00:00Z" },
];

export const mockPerformanceData: PerformancePoint[] = Array.from({ length: 24 }, (_, i) => ({
  time: `${String(i).padStart(2, "0")}:00`,
  requestRate: Math.floor(80 + Math.random() * 40),
  p50: Math.floor(8 + Math.random() * 5),
  p95: Math.floor(25 + Math.random() * 15),
  p99: Math.floor(80 + Math.random() * 40),
  errorRate: +(Math.random() * 0.5).toFixed(2),
}));

export const mockResourceUtilization: ResourceUtilization[] = [
  { label: "Database CPU", current: 34, max: 100, unit: "%" },
  { label: "Database Memory", current: 2.1, max: 4, unit: "GB" },
  { label: "Database Disk I/O", current: 120, max: 500, unit: "IOPS" },
  { label: "Storage Used", current: 12.4, max: 50, unit: "GB" },
  { label: "Network Bandwidth", current: 45, max: 200, unit: "Mbps" },
];

export const mockAlertRules: AlertRule[] = [
  { id: "alert_1", name: "High API error rate", condition: "Error rate > 5% for 5 minutes", status: "active" },
  { id: "alert_2", name: "Database CPU spike", condition: "CPU > 80% for 10 minutes", status: "active" },
  { id: "alert_3", name: "Storage approaching limit", condition: "Storage > 90% of quota", status: "active" },
  { id: "alert_4", name: "Agent response timeout", condition: "Agent p99 > 10s for 5 minutes", status: "muted", lastTriggered: "2026-04-20T09:00:00Z" },
];

export const mockUptimeData = Array.from({ length: 90 }, (_, i) => ({
  date: `Day ${90 - i}`,
  uptime: i === 45 ? 99.5 : i === 60 ? 98.8 : 100,
}));
