"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Agent = { id: string; name: string };
type Readiness = { agent_id: string; readiness_score: number | null };
type Approval = { agent_id: string; status: string; created_at: string };
export default function ClientTestingApprovalControl({ organizationId, agents, readiness, approvals }: { organizationId: string; agents: Agent[]; readiness: Readiness[]; approvals: Map<string, Approval> }) {
  const router = useRouter();
  const [message, setMessage] = useState("Hello, I would like to learn more about your services.");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  async function call(path: string, body: Record<string, unknown>) {
    setBusy(path); setNotice("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The gate action failed.");
      setNotice(result.reply ? `Live runtime passed: ${result.reply}` : "Gate completed successfully.");
      router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The gate action failed."); } finally { setBusy(""); }
  }
  const ready = new Map(readiness.map(item => [item.agent_id, Number(item.readiness_score || 0)]));
  return (
    <div className="admin-list" style={{ marginTop: 16 }}>
      <div className="admin-list-row" style={{ alignItems: "flex-start", display: "grid", gap: 10 }}>
        <div><strong>Live runtime test</strong><span>Sends the test message through the real tenant AgentRuntimeSDK and records the actual response. It does not send WhatsApp messages or execute proposed tools.</span></div>
        <textarea aria-label="Test message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={{ width: "100%", resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {agents.map(agent => <button key={agent.id} className="admin-button secondary" disabled={Boolean(busy)} onClick={() => call("/api/admin/clients/run-test", { organizationId, agentId: agent.id, message })}>{busy === "/api/admin/clients/run-test" ? "Running..." : "Test " + agent.name}</button>)}
        </div>
      </div>
      <div className="admin-list-row">
        <div><strong>Approval</strong><span>Approval follows a fresh live runtime test. Launch remains blocked until every agent is approved.</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {agents.map(agent => { const approval = approvals.get(agent.id); const canRequest = ready.get(agent.id) === 100 && approval?.status !== "approved"; return <button key={"request-" + agent.id} className="admin-button secondary" disabled={Boolean(busy) || !canRequest} onClick={() => call("/api/admin/clients/request-approval", { organizationId, agentId: agent.id })}>{approval?.status === "submitted" ? "Approval pending" : approval?.status === "changes_requested" ? "Resubmit " + agent.name : "Request " + agent.name}</button>; })}
          {agents.map(agent => { const approval = approvals.get(agent.id); const canApprove = approval?.status === "submitted"; return <button key={"approve-" + agent.id} className="admin-button" disabled={Boolean(busy) || !canApprove} onClick={() => call("/api/admin/clients/decide-approval", { organizationId, agentId: agent.id, decision: "approved" })}>{canApprove ? "Approve " + agent.name : approval?.status === "approved" ? "Approved" : "Approve " + agent.name}</button>; })}
        </div>
      </div>
      {notice ? <p className="admin-form-message">{notice}</p> : null}
    </div>
  );
}