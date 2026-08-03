"use client";

import { useState, useTransition } from "react";

type Props = {
  leadId?: string;
  email?: string;
  name?: string;
};

const actions = [
  { label: "Hot", action: "mark_hot" },
  { label: "Warm", action: "mark_warm" },
  { label: "Cold", action: "mark_cold" },
  { label: "Follow Up", action: "move_following_up" },
  { label: "Onboarding", action: "move_onboarding" },
  { label: "Do Not Contact", action: "do_not_contact" },
];

export default function GencouvLeadActions({ leadId, email, name }: Props) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("");

  const runAction = (action: string) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/gencouv/email-control", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            lead_id: leadId,
            email,
            name,
            requested_by: "flux-knight-dashboard",
          }),
        });
        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.message || "Action failed.");
        }
        setStatus("Recorded");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Action failed.");
      }
    });
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
      {actions.map((item) => (
        <button
          key={item.action}
          type="button"
          disabled={isPending}
          onClick={() => runAction(item.action)}
          style={{
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 999,
            padding: "7px 10px",
            color: "var(--admin-text)",
            background: "rgba(255,255,255,.05)",
            cursor: "pointer",
            fontSize: ".78rem",
          }}
        >
          {item.label}
        </button>
      ))}
      {status ? (
        <span style={{ color: "var(--admin-text-muted)", fontSize: ".78rem", alignSelf: "center" }}>
          {isPending ? "Saving..." : status}
        </span>
      ) : null}
    </div>
  );
}
