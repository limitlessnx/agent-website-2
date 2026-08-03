export type RuntimeExecution = {
  id: string;
  organization_id: string;
  agent_id: string;
  conversation_id: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
  input: Record<string, unknown>;
};

export type RuntimePrompt = {
  version: number;
  assembled_prompt: string;
};

export type RuntimeMemory = {
  id: string;
  type: string;
  key: string;
  value: unknown;
  confidence: number | null;
  updated_at?: string | null;
  score: number;
};

export type RuntimeKnowledge = {
  id: string;
  collection_id: string | null;
  title: string;
  type: string;
  content: string;
  status: string;
  score: number;
};

export type RuntimeTool = {
  id: string;
  key: string;
  name: string;
  description: string;
  handler: "internal" | "workflow" | "approval";
  input_schema: Record<string, unknown>;
  required_permissions: string[];
  status: string;
};

export type RuntimePolicyDecision = {
  key: string;
  outcome: "allow" | "deny" | "approval_required" | "limit";
  reason: string;
  details: Record<string, unknown>;
};

export type PlannedToolCall = {
  tool_id: string;
  tool_key: string;
  status: "requested" | "denied";
  input: Record<string, unknown>;
  policy: RuntimePolicyDecision;
};

export type ProviderRequest = {
  provider_assignment_id: string | null;
  status: "prepared";
  request_payload: Record<string, unknown>;
};

export type CompiledRuntimeContext = {
  execution: RuntimeExecution;
  prompt: RuntimePrompt;
  compiledPrompt: string;
  memories: RuntimeMemory[];
  knowledge: RuntimeKnowledge[];
  tools: RuntimeTool[];
  policy: {
    external_execution_enabled: false;
    live_provider_execution_enabled: false;
    n8n_execution_enabled: false;
    decisions: RuntimePolicyDecision[];
    approval_required_for: string[];
  };
  plannedToolCalls: PlannedToolCall[];
  providerRequest: ProviderRequest;
  checksum: string;
};
