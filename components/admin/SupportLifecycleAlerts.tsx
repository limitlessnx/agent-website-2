"use client";

import { useEffect, useState } from "react";

type AlertItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  targetState: string;
  escalationRequested: boolean;
  escalationRequired: boolean;
  recurringIssue: boolean;
  recurringCount: number;
  organization: { id: string; name: string; slug: string };
};

type Summary = { organizations: number; openCases: number; escalations: number; recurring: number };

export default function SupportLifecycleAlerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ organizations: 0, openCases: 0, escalations: 0, recurring: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/support/lifecycle", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Unable to load support alerts.");
        setAlerts(Array.isArray(result.alerts) ? result.alerts : []);
        setSummary(result.summary || { organizations: 0, openCases: 0, escalations: 0, recurring: 0 });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load support alerts."));
  }, []);

  return (
    <section className="admin-card" style={{ marginBottom: 18 }}>
      <div className="admin-card-header">
        <div>
          <h2>Support risk queue</h2>
          <p>Tenant cases that are overdue, nearing response targets, recurring, or require human review.</p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <strong>{summary.openCases} open</strong>
        <strong>{summary.escalations} escalations</strong>
        <strong>{summary.recurring} recurring</strong>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {!error && !alerts.length ? <p>No support cases currently require elevated attention.</p> : null}
      <div className="admin-list">
        {alerts.slice(0, 20).map((item) => (
          <div className="admin-list-row" key={item.id}>
            <div>
              <strong>{item.organization.name}: {item.title}</strong>
              <span>{item.priority} priority · {item.status.replaceAll("_", " ")} · {item.targetState.replaceAll("_", " ")}</span>
              {item.escalationRequested ? <span>Customer requested human review</span> : null}
              {item.recurringIssue ? <span>Recurring pattern detected ({item.recurringCount} similar cases)</span> : null}
            </div>
            <em>{item.escalationRequired ? "escalate" : "watch"}</em>
          </div>
        ))}
      </div>
    </section>
  );
}
