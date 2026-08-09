// AgentSpec v1 — TypeScript definitions.
// Contract: docs/RACHDEV_AGENTSPEC_CONTRACT.md. Keep in sync with agentSpec.schema.json.

export type ToolType = "http_action" | "knowledge_base" | "handoff" | "function";
export type ChannelType = "web_widget" | "whatsapp" | "voice" | "email" | "api";
export type RuntimeTargetType = "rachbase" | "onprem" | "byoc";
export type ModelClass = "fast" | "balanced" | "reasoning";
export type AgentStatus = "draft" | "published" | "deployed" | "disabled";

export interface TemplateRef {
  slug: string;
  version: number;
}

export interface ModelPolicy {
  class: ModelClass;
  /** Optional concrete catalog model id that overrides class resolution. */
  pin?: string;
}

export interface Tool {
  id: string;
  type: ToolType;
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface Guardrails {
  pii?: { redact?: boolean; block_output?: boolean };
  topics?: { allow?: string[]; block?: string[] };
  human_review?: { required?: boolean; roles?: string[] };
  limits?: { max_output_tokens?: number; max_turns?: number };
  escalation?: {
    on: ("low_confidence" | "explicit_request" | "blocked_topic")[];
    action_tool_id?: string;
  };
  refusal_message?: string;
}

export interface Channel {
  type: ChannelType;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface RuntimeTarget {
  type: RuntimeTargetType;
  ref?: string;
}

export interface KnowledgeSource {
  id: string;
  type: "document" | "url" | "collection";
  config?: Record<string, unknown>;
}

export interface AgentSpec {
  spec_version: "1.0";
  id: number;
  tenant_id: number | null;
  key: string;
  template_ref: TemplateRef | null;
  industry: string | null;
  name: string;
  role: string;
  description: string;

  prompt: string;
  model_policy: ModelPolicy;
  tools: Tool[];
  guardrails: Guardrails;
  knowledge: { sources: KnowledgeSource[] } | null;

  channels: Channel[];
  runtime_target: RuntimeTarget;

  status: AgentStatus;
  version: number;
  created_at?: string;
  updated_at?: string;
  published_at: string | null;
  created_by: number | null;
}

/** Editable subset a builder/user may submit on create/update. */
export type AgentSpecInput = Partial<
  Pick<
    AgentSpec,
    | "key" | "name" | "role" | "description" | "industry" | "template_ref"
    | "prompt" | "model_policy" | "tools" | "guardrails" | "knowledge"
    | "channels" | "runtime_target"
  >
>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const AGENT_SPEC_VERSION: "1.0";
export function validateAgentSpec(spec: unknown): ValidationResult;
export function validateAgentSpecInput(
  body: unknown,
  opts?: { partial?: boolean }
): ValidationResult;
export function rowToSpec(row: Record<string, unknown>): AgentSpec;
export function columnsFromInput(body: AgentSpecInput): Record<string, unknown>;
