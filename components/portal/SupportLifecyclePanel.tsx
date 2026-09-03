"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SupportCase = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedAgent: string;
  createdAt: string;
  updatedAt: string;
  responseTargetAt: string;
  targetState: "healthy" | "due_soon" | "overdue" | "resolved";
  escalationRequested: boolean;
  escalationRequired: boolean;
  recurringIssue: boolean;
  recurringCount: number;
  feedbackScore: number | null;
  feedbackComment: string | null;
};

function targetLabel(value: SupportCase["targetState"]) {
  if (value === "overdue") return "Needs attention";
  if (value === "due_soon") return "Due soon";
  if (value === "resolved") return "Resolved";
  return "On track";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

export default function SupportLifecyclePanel() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/portal/support/lifecycle", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Unable to load support cases.");
    setCases(Array.isArray(result.cases) ? result.cases : []);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load support cases.")).finally(() => setLoading(false));
  }, [load]);

  const summary = useMemo(() => ({
    open: cases.filter((item) => !["resolved", "closed"].includes(item.status)).length,
    attention: cases.filter((item) => item.escalationRequired || item.targetState === "overdue").length,
    recurring: cases.filter((item) => item.recurringIssue).length,
  }), [cases]);

  async function mutate(caseId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(caseId);
    setError("");
    try {
      const response = await fetch("/api/portal/support/lifecycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, action, ...extra }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Support action failed.");
      setCases(Array.isArray(result.cases) ? result.cases : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Support action failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function requestEscalation(item: SupportCase) {
    const reason = window.prompt("What should the human support team review?", item.title) || "";
    if (!reason.trim()) return;
    await mutate(item.id, "request_escalation", { reason });
  }

  async function submitFeedback(item: SupportCase) {
    const raw = window.prompt("Rate this support case from 1 to 5", item.feedbackScore ? String(item.feedbackScore) : "5");
    if (!raw) return;
    const score = Number(raw);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      setError("Feedback score must be between 1 and 5.");
      return;
    }
    const comment = window.prompt("Optional feedback", item.feedbackComment || "") || "";
    await mutate(item.id, "submit_feedback", { score, comment });
  }

  return (
    <section className="portal-card" style={{ marginTop: 20 }}>
      <div className="portal-card-head">
        <div>
          <h2>Support cases</h2>
          <p>Track Agent Leo cases, human escalation, response targets, recurring issues, and resolution status.</p>
        </div>
      </div>

      <div className="portal-grid" style={{ marginBottom: 18 }}>
        <div className="portal-list-row"><div><strong>Open cases</strong><span>Cases still being diagnosed or reviewed.</span></div><em>{summary.open}</em></div>
        <div className="portal-list-row"><div><strong>Needs attention</strong><span>Overdue, critical, or escalation-required cases.</span></div><em>{summary.attention}</em></div>
        <div className="portal-list-row"><div><strong>Recurring issues</strong><span>Similar problems appearing at least three times.</span></div><em>{summary.recurring}</em></div>
      </div>

      {error ? <p role="alert" style={{ marginBottom: 12 }}>{error}</p> : null}
      {loading ? <p>Loading support lifecycle…</p> : null}
      {!loading && !cases.length ? <p>No support cases yet. Start a conversation with Agent Leo above when you need help.</p> : null}

      <div className="portal-list">
        {cases.map((item) => {
          const resolved = ["resolved", "closed"].includes(item.status);
          return (
            <div className="portal-list-row" key={item.id} style={{ alignItems: "flex-start", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <strong>{item.title || "Support case"}</strong>
                <span>
                  {item.priority} priority · {item.status.replaceAll("_", " ")} · {targetLabel(item.targetState)}
                </span>
                <span>Response target: {formatDate(item.responseTargetAt)}</span>
                {item.escalationRequested ? <span>Human review requested</span> : null}
                {item.recurringIssue ? <span>Recurring pattern detected across {item.recurringCount} similar cases</span> : null}
                {item.feedbackScore ? <span>Feedback: {item.feedbackScore}/5</span> : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {!resolved && !item.escalationRequested ? (
                    <button type="button" disabled={busyId === item.id} onClick={() => requestEscalation(item)}>Request human review</button>
                  ) : null}
                  {!resolved ? (
                    <button type="button" disabled={busyId === item.id} onClick={() => mutate(item.id, "resolve")}>Mark resolved</button>
                  ) : (
                    <button type="button" disabled={busyId === item.id} onClick={() => mutate(item.id, "reopen")}>Reopen case</button>
                  )}
                  {resolved ? (
                    <button type="button" disabled={busyId === item.id} onClick={() => submitFeedback(item)}>Rate support</button>
                  ) : null}
                </div>
              </div>
              <em>{item.escalationRequired ? "attention" : targetLabel(item.targetState).toLowerCase()}</em>
            </div>
          );
        })}
      </div>
    </section>
  );
}
