"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StarterProvisioningRetry({ organizationId }: { organizationId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/organizations/${encodeURIComponent(organizationId)}/n8n/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json();
      setMessage(response.ok ? payload.result?.message || "Refresh setup to review provisioning." : payload.error || "Unable to confirm provisioning.");
      router.refresh();
    } catch { setMessage("Unable to confirm provisioning. Refresh setup before retrying."); }
    finally { setBusy(false); }
  }
  return <div style={{ marginTop: 16 }}><button type="button" className="admin-button secondary" disabled={busy} aria-busy={busy} onClick={retry}>{busy ? "Retrying setup…" : "Retry starter automation setup"}</button><p role="status" aria-live="polite">{message}</p></div>;
}
