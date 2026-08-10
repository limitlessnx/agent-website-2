"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Notification = {
  id: string;
  recipient_email: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
};

export default function DeliveryPreparationPanel({
  onboardingId,
  organizationId,
  notifications,
}: {
  onboardingId: string;
  organizationId?: string | null;
  notifications: Notification[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function prepareDelivery() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/onboarding/prepare-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to finalize workspace preparation.");

      const summary = Array.isArray(result.result) ? result.result[0] : result.result;
      setMessage(`Workspace synchronized: ${summary?.agents_updated ?? 0} agents updated and the client notification drafted.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to finalize workspace preparation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="admin-panel">
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>Final workspace preparation</summary>
      <div style={{ marginTop: 16 }}>
        <div className="admin-panel-header">
          <div>
            <h2>Finalize client workspace</h2>
            <p>This is the final synchronization step after the tenant template, agents, AI model and required integrations have been configured. It applies approved onboarding information to the provisioned agents and knowledge, then drafts the workspace-ready notification.</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {organizationId ? <Link className="admin-button secondary" href={`/dashboard/clients/${encodeURIComponent(organizationId)}/setup`}>Open client setup</Link> : null}
          <button className="admin-button" type="button" disabled={busy || !organizationId} onClick={prepareDelivery}>
            {busy ? "Finalizing..." : "Finalize preparation"}
          </button>
        </div>

        {!organizationId ? <p className="admin-form-message">Create or link the organization before final preparation.</p> : null}
        {message ? <p className="admin-form-message">{message}</p> : null}

        <div className="admin-list" style={{ marginTop: 14 }}>
          {notifications.map((notification) => (
            <div className="admin-list-row" key={notification.id}>
              <div>
                <strong>{notification.subject}</strong>
                <span>{notification.recipient_email} · {notification.status}</span>
                <span>{notification.body}</span>
              </div>
            </div>
          ))}
          {!notifications.length ? <p>No workspace-ready notification has been prepared yet.</p> : null}
        </div>
      </div>
    </details>
  );
}
