export interface ActivityEvent {
  id: string;
  type: "api_key_created" | "agent_deployed" | "user_signup" | "table_created" | "backup_completed" | "team_invite" | "settings_changed" | "agent_error";
  description: string;
  timestamp: string;
  actor: string;
  link?: string;
}

export const mockActivity: ActivityEvent[] = [
  { id: "act_1", type: "agent_deployed", description: "Customer Support Bot deployed to production", timestamp: "2026-04-27T09:00:00Z", actor: "Eshan Cheema" },
  { id: "act_2", type: "user_signup", description: "New user signed up: grace@example.org", timestamp: "2026-04-27T08:45:00Z", actor: "System" },
  { id: "act_3", type: "api_key_created", description: "API key 'mobile-app' created with read-write scope", timestamp: "2026-04-27T08:30:00Z", actor: "Sarah Kim" },
  { id: "act_4", type: "backup_completed", description: "Daily backup completed (12.4 MB)", timestamp: "2026-04-27T03:00:00Z", actor: "System" },
  { id: "act_5", type: "table_created", description: "Table 'reviews' created with 7 columns", timestamp: "2026-04-26T16:30:00Z", actor: "Eshan Cheema" },
  { id: "act_6", type: "team_invite", description: "Invited priya@external.com as Developer", timestamp: "2026-04-26T14:00:00Z", actor: "Raghav" },
  { id: "act_7", type: "settings_changed", description: "Rate limit updated: 1000 → 2000 req/min", timestamp: "2026-04-26T11:00:00Z", actor: "Eshan Cheema" },
  { id: "act_8", type: "agent_error", description: "Lead Qualifier: timeout connecting to CRM", timestamp: "2026-04-26T09:15:00Z", actor: "System" },
  { id: "act_9", type: "user_signup", description: "New user signed up: henry@demo.io", timestamp: "2026-04-25T15:00:00Z", actor: "System" },
  { id: "act_10", type: "agent_deployed", description: "Lead Qualifier v2 deployed", timestamp: "2026-04-25T10:00:00Z", actor: "Raghav" },
];
