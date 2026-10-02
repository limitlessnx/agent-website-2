"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Loader2 } from "@/components/admin/ServerIcons";

export default function ProvisionFromBriefControl({ organizationId, disabled = false }: { organizationId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function provision() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/clients/provision-from-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to build the recommended setup.");
      setMessage(`Recommended setup built: ${result.provisionedAgentCount || 0} AI worker(s) provisioned. Review configuration before testing.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to build the recommended setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
      <button className="admin-button" type="button" onClick={provision} disabled={busy || disabled}>
        {busy ? <Loader2 size={14} className="spin" /> : <Bot size={14} />}
        {busy ? "Building setup..." : "Build recommended setup"}
      </button>
      <small className="muted">Uses the submitted brief to recommend and provision draft AI workers. It does not launch the tenant.</small>
      {message ? <small className="admin-form-message">{message}</small> : null}
    </div>
  );
}
