"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Agent = { id: string; name: string };
export default function ClientTestingApprovalControl({ organizationId, agents }: { organizationId: string; agents: Agent[] }) {
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
      setNotice("Gate completed successfully."); router.refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The gate action failed."); } finally { setBusy(""); }
  }
  return (
    <div className="admin-list" style={{ marginTop: 16 }}>
      <div className="admin-list-row" style={{ alignItems: "flex-start", display: "grid", gap: 10 }}>
        <div><strong>Configuration test</strong><span>Runs the tenant-scoped validation and records a real passed/failed test run. It does not invoke a live model.</span></div>
        <textarea aria-label="Test message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} style={{ width: "100%", resize: "vertical" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {agents.map(agent => <button key={agent.id} className="admin-button secondary" disabled={Boolean(busy)} onClick={() => call("/api/admin/clients/run-test", { organizationId, agentId: agent.id, message })}>{busy === "/api/admin/clients/run-test" ? "Testing..." : "Test " + agent.name}</button>)}
        </div>
      </div>
      <div className="admin-list-row">
        <div><strong>Approval</strong><span>Submit a passed agent for approval, then record the Super Admin decision.</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {agents.map(agent => <button key={"request-" + agent.id} className="admin-button secondary" disabled={Boolean(busy)} onClick={() => call("/api/admin/clients/request-approval", { organizationId, agentId: agent.id })}>{busy === "/api/admin/clients/request-approval" ? "Submitting..." : "Request " + agent.name}</button>)}
          {agents.map(agent => <button key={"approve-" + agent.id} className="admin-button" disabled={Boolean(busy)} onClick={() => call("/api/admin/clients/decide-approval", { organizationId, agentId: agent.id, decision: "approved" })}>{busy === "/api/admin/clients/decide-approval" ? "Approving..." : "Approve " + agent.name}</button>)}
        </div>
      </div>
      {notice ? <p className="admin-form-message">{notice}</p> : null}
    </div>
  );
}