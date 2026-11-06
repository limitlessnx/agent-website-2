type ToolInput = { toolKey: string; arguments: Record<string, unknown>; sessionId?: string; channel: "chat" | "voice"; confirmed: boolean };
type Approval = { approvalId: string; approvalToken: string };
export type LeoClientApprovals = Map<string, Approval>;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k => [k, JSON.parse(canonical((value as Record<string, unknown>)[k]))])));
  return JSON.stringify(value);
}
/** Tokens stay in memory, outside chat history, model output and browser storage. */
export async function executeLeoClientTool(input: ToolInput, approvals: LeoClientApprovals, fetcher: typeof fetch = fetch) {
  const key = canonical({ toolKey: input.toolKey, arguments: input.arguments, sessionId: input.sessionId || "", channel: input.channel });
  const proof = input.confirmed ? approvals.get(key) : undefined;
  const response = await fetcher("/api/leo/tool", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, ...proof }) });
  const raw = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (input.toolKey === "leo.crm.followup.send" && raw.status === "confirmation_required" && typeof raw.approvalToken === "string" && typeof raw.approvalId === "string") {
    approvals.set(key, { approvalId: raw.approvalId, approvalToken: raw.approvalToken });
  }
  // Keep proof for an ambiguous enqueue retry. The server maps it to the same execution.
  if (response.ok && raw.executionId) approvals.delete(key);
  const result = { ...raw };
  if (input.toolKey === "leo.crm.followup.send" && raw.approvalToken) delete result.approvalToken;
  return { response, result };
}
export function leoExecutionPending(result: Record<string, unknown>) {
  return ["queued", "processing", "sending", "pending_dispatch", "enqueue_unknown"].includes(String(result.status));
}
export function leoExecutionMessage(result: Record<string, unknown>) {
  if (["pending_dispatch", "enqueue_unknown"].includes(String(result.status))) return "Dispatch is unconfirmed. Check the execution record before retrying this approval.";
  if (leoExecutionPending(result)) return "Follow-up queued. Execution and delivery are not yet confirmed.";
  const nested = result.result as Record<string, unknown> | null;
  if (nested?.delivery_status === "provider_accepted") return "Follow-up accepted by the provider. Delivery is not yet confirmed.";
  return String(result.error || result.message || "Execution outcome requires review.");
}
