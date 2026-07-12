export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warning" | "error" | "fatal";
  source: "api" | "database" | "auth" | "agent" | "storage" | "system";
  message: string;
  details?: Record<string, string | number>;
}

export const mockLogs: LogEntry[] = [
  { id: "log_1", timestamp: "2026-04-27T10:05:23Z", level: "info", source: "api", message: "GET /rest/v1/users - 200 OK (12ms)" },
  { id: "log_2", timestamp: "2026-04-27T10:05:20Z", level: "info", source: "agent", message: "Agent 'Customer Support Bot' processed message", details: { agentId: "agent_1", tokens: 850, costUsd: 0.003 } },
  { id: "log_3", timestamp: "2026-04-27T10:04:58Z", level: "warning", source: "database", message: "Slow query detected (>500ms)", details: { query: "SELECT * FROM orders JOIN...", durationMs: 620 } },
  { id: "log_4", timestamp: "2026-04-27T10:04:45Z", level: "info", source: "auth", message: "User login successful: alice@example.com", details: { provider: "email", ip: "192.168.1.1" } },
  { id: "log_5", timestamp: "2026-04-27T10:04:30Z", level: "error", source: "agent", message: "Agent 'Lead Qualifier' failed to connect to CRM", details: { agentId: "agent_2", error: "ECONNREFUSED" } },
  { id: "log_6", timestamp: "2026-04-27T10:04:15Z", level: "info", source: "api", message: "POST /rest/v1/orders - 201 Created (45ms)" },
  { id: "log_7", timestamp: "2026-04-27T10:03:50Z", level: "info", source: "storage", message: "File uploaded: invoice_2026_04.pdf (2.4MB)" },
  { id: "log_8", timestamp: "2026-04-27T10:03:30Z", level: "warning", source: "system", message: "API rate limit at 78% for key 'mobile-app'" },
  { id: "log_9", timestamp: "2026-04-27T10:03:10Z", level: "info", source: "auth", message: "New user registered: henry@demo.io" },
  { id: "log_10", timestamp: "2026-04-27T10:02:45Z", level: "error", source: "api", message: "POST /rest/v1/products - 500 Internal Server Error", details: { error: "unique_violation", constraint: "products_sku_key" } },
  { id: "log_11", timestamp: "2026-04-27T10:02:20Z", level: "info", source: "database", message: "Backup completed successfully (12.4 MB)" },
  { id: "log_12", timestamp: "2026-04-27T10:01:55Z", level: "info", source: "agent", message: "Agent 'Appointment Scheduler' paused by user" },
  { id: "log_13", timestamp: "2026-04-27T10:01:30Z", level: "fatal", source: "system", message: "Memory usage critical: 95% of allocated resources" },
  { id: "log_14", timestamp: "2026-04-27T10:01:00Z", level: "info", source: "api", message: "GET /rest/v1/products?category=electronics - 200 OK (8ms)" },
  { id: "log_15", timestamp: "2026-04-27T10:00:30Z", level: "info", source: "auth", message: "Password reset requested: dave@demo.com" },
];
