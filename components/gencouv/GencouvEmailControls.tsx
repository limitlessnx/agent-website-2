"use client";

import { useState, useTransition } from "react";
import GencouvSequenceEditor from "@/components/gencouv/GencouvSequenceEditor";

type Props = {
  dailyLimit: number;
  maxDailyLimit: number;
  sendingEnabled: boolean;
};

const quickActions = [
  { label: "Preview Sequence", action: "preview_sequence" },
  { label: "Pause Sequence", action: "pause_sequence" },
  { label: "Stop Sequence", action: "stop_sequence" },
  { label: "Move to Following Up", action: "move_following_up" },
  { label: "Move to Onboarding", action: "move_onboarding" },
  { label: "Do Not Contact", action: "do_not_contact" },
];

async function sendDashboardAction(payload: Record<string, unknown>) {
  const response = await fetch("/api/gencouv/email-control", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "The dashboard action could not be recorded.");
  }
  return data;
}

export default function GencouvEmailControls({ dailyLimit, maxDailyLimit, sendingEnabled }: Props) {
  const [selectedLimit, setSelectedLimit] = useState(Math.min(Math.max(dailyLimit || 10, 1), maxDailyLimit || 10));
  const [message, setMessage] = useState("Email sending is locked. Controls record sequence intent only.");
  const [isPending, startTransition] = useTransition();

  const runAction = (action: string, extra: Record<string, unknown> = {}) => {
    startTransition(async () => {
      try {
        const result = await sendDashboardAction({
          action,
          daily_limit: selectedLimit,
          requested_by: "flux-knight-dashboard",
          ...extra,
        });
        setMessage(result.message || "Dashboard action recorded.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "The dashboard action failed.");
      }
    });
  };

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Email control center</h2>
            <p>Control sequence readiness, follow-up state, and sender warm-up without exposing backend workflow machinery.</p>
          </div>
          <span className={sendingEnabled ? "admin-status live" : "admin-status warning"}>
            {sendingEnabled ? "sending enabled" : "sending locked"}
          </span>
        </div>

        <details>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Sending controls</summary>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 14 }}>
            <label style={{ display: "grid", gap: 8, color: "var(--admin-text-soft)", fontSize: ".88rem" }}>
              Daily email amount
              <select value={selectedLimit} onChange={(event) => setSelectedLimit(Number(event.target.value))}>
                {Array.from({ length: maxDailyLimit || 10 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{value} emails / day</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => runAction("update_daily_limit", { notes: "Dashboard daily warm-up limit updated." })} disabled={isPending} style={{ alignSelf: "end" }}>
              Save Daily Limit
            </button>
          </div>

          <div className="admin-checklist" style={{ marginTop: 18 }}>
            {quickActions.map((item) => (
              <button key={item.action} type="button" onClick={() => runAction(item.action)} disabled={isPending}>
                {item.label}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--admin-text-muted)", lineHeight: 1.6, margin: "16px 0 0" }}>
            {isPending ? "Recording dashboard action..." : message}
          </p>
        </details>
      </section>

      <GencouvSequenceEditor />
    </>
  );
}
