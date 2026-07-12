export interface Agent {
  id: string;
  name: string;
  description: string;
  template: string;
  industry: string;
  status: "active" | "draft" | "paused";
  lastInteraction: string;
  interactionsThisMonth: number;
  interactionsWeekly: number[];
  avgResponseTime: number;
  satisfactionRate: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  userId: string;
  userName: string;
  startedAt: string;
  duration: number;
  messages: number;
  resolution: "resolved" | "escalated" | "abandoned";
  preview: string;
}

export interface DecisionStep {
  id: string;
  type: "trigger" | "knowledge" | "llm" | "action" | "response";
  label: string;
  detail: string;
  tokenCount?: number;
  cost?: number;
  durationMs: number;
}

export const mockAgents: Agent[] = [
  {
    id: "agent_1",
    name: "Customer Support Bot",
    description: "Handles customer inquiries, order status, and returns",
    template: "Customer Support",
    industry: "E-Commerce",
    status: "active",
    lastInteraction: "2026-04-27T09:45:00Z",
    interactionsThisMonth: 1842,
    interactionsWeekly: [245, 312, 280, 298, 256, 310, 290],
    avgResponseTime: 1.2,
    satisfactionRate: 0.92,
    createdAt: "2026-01-20T10:00:00Z",
  },
  {
    id: "agent_2",
    name: "Lead Qualifier",
    description: "Qualifies inbound leads and routes to sales team",
    template: "Lead Qualification",
    industry: "SaaS",
    status: "active",
    lastInteraction: "2026-04-27T08:30:00Z",
    interactionsThisMonth: 567,
    interactionsWeekly: [78, 92, 85, 71, 88, 95, 80],
    avgResponseTime: 0.8,
    satisfactionRate: 0.88,
    createdAt: "2026-02-10T14:00:00Z",
  },
  {
    id: "agent_3",
    name: "Appointment Scheduler",
    description: "Books appointments and manages calendar",
    template: "Appointment Scheduling",
    industry: "Healthcare",
    status: "paused",
    lastInteraction: "2026-04-20T16:00:00Z",
    interactionsThisMonth: 234,
    interactionsWeekly: [45, 38, 42, 50, 0, 0, 0],
    avgResponseTime: 1.5,
    satisfactionRate: 0.85,
    createdAt: "2026-03-01T09:00:00Z",
  },
  {
    id: "agent_4",
    name: "FAQ Assistant",
    description: "Answers frequently asked questions from knowledge base",
    template: "FAQ Bot",
    industry: "General",
    status: "draft",
    lastInteraction: "",
    interactionsThisMonth: 0,
    interactionsWeekly: [0, 0, 0, 0, 0, 0, 0],
    avgResponseTime: 0,
    satisfactionRate: 0,
    createdAt: "2026-04-15T11:00:00Z",
  },
];

export const mockConversations: Conversation[] = [
  { id: "conv_1", agentId: "agent_1", userId: "au_1", userName: "Alice Johnson", startedAt: "2026-04-27T09:45:00Z", duration: 180, messages: 8, resolution: "resolved", preview: "I need to return my order #4521..." },
  { id: "conv_2", agentId: "agent_1", userId: "au_2", userName: "Bob Smith", startedAt: "2026-04-27T09:30:00Z", duration: 120, messages: 5, resolution: "resolved", preview: "What's the status of my delivery?" },
  { id: "conv_3", agentId: "agent_1", userId: "au_5", userName: "Eve Davis", startedAt: "2026-04-27T08:15:00Z", duration: 300, messages: 12, resolution: "escalated", preview: "I was charged twice for my order..." },
  { id: "conv_4", agentId: "agent_2", userId: "au_3", userName: "Carol Williams", startedAt: "2026-04-27T08:30:00Z", duration: 90, messages: 4, resolution: "resolved", preview: "I'm interested in your enterprise plan..." },
  { id: "conv_5", agentId: "agent_2", userId: "au_7", userName: "Grace Lee", startedAt: "2026-04-26T16:00:00Z", duration: 60, messages: 3, resolution: "abandoned", preview: "Can you tell me about pricing?" },
];

export const mockDecisionTrace: DecisionStep[] = [
  { id: "step_1", type: "trigger", label: "Message Received", detail: "User sent: 'I need to return my order #4521'", durationMs: 5 },
  { id: "step_2", type: "knowledge", label: "Knowledge Retrieval", detail: "Searched return policy docs. Found 3 relevant chunks.", tokenCount: 1200, durationMs: 120 },
  { id: "step_3", type: "llm", label: "LLM Call (Claude Sonnet)", detail: "Generated response with return instructions and order lookup", tokenCount: 850, cost: 0.003, durationMs: 800 },
  { id: "step_4", type: "action", label: "Order Lookup", detail: "Queried orders API for #4521. Status: delivered.", durationMs: 150 },
  { id: "step_5", type: "response", label: "Response Sent", detail: "Sent return instructions with prepaid label link", durationMs: 10 },
];
