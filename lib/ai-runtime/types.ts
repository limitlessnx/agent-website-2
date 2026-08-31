import type { LeoIdentity, LeoToolDefinition } from "@/lib/leo-core";

export type RuntimeChannel = "chat" | "voice" | "api" | "whatsapp" | "telegram" | "email";
export type RuntimeMessageRole = "system" | "user" | "assistant" | "tool";
export type RuntimeApprovalStatus = "not_required" | "pending" | "approved" | "rejected" | "expired" | "cancelled";

export type RuntimeMessage = {
  id?: string;
  role: RuntimeMessageRole;
  content: string;
  toolName?: string;
  toolCallId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type RuntimeModelRoute = {
  provider: string;
  modelId?: string;
  modelKey: string;
  source: "super_admin_override" | "agent_assignment" | "organization_assignment" | "agent_default" | "environment_default";
  fallbackModelKey?: string;
};

export type RuntimeContext = {
  identity: LeoIdentity;
  organizationId?: string;
  agentId?: string;
  agentName: string;
  sessionId?: string;
  channel: RuntimeChannel;
  objective: string;
  systemPrompt: string;
  memory: RuntimeMessage[];
  tools: LeoToolDefinition[];
  model: RuntimeModelRoute;
  metadata: Record<string, unknown>;
};

export type RuntimeToolCall = {
  id: string;
  toolKey: string;
  arguments: Record<string, unknown>;
  reason?: string;
  approvalStatus: RuntimeApprovalStatus;
};

export type RuntimeToolExecutionResult = {
  toolKey: string;
  status: "succeeded" | "failed" | "rejected" | "approval_required";
  output?: unknown;
  error?: string;
  approvalRequestId?: string;
};

export type RuntimeStreamEvent =
  | { type: "runtime.started"; executionId: string; at: string }
  | { type: "runtime.context"; executionId: string; model: RuntimeModelRoute; toolCount: number; at: string }
  | { type: "runtime.delta"; executionId: string; delta: string; at: string }
  | { type: "runtime.tool"; executionId: string; tool: RuntimeToolExecutionResult; at: string }
  | { type: "runtime.completed"; executionId: string; at: string }
  | { type: "runtime.failed"; executionId: string; error: string; at: string };

export type RuntimeAgentMessage = {
  organizationId: string;
  sourceAgentId: string;
  targetAgentId: string;
  event: string;
  payload: Record<string, unknown>;
  correlationId: string;
};
