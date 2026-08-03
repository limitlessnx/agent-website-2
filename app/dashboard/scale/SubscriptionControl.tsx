"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

export default function SubscriptionControl({ organizations, plans }: { organizations: Option[]; plans: Option[] }) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id || "");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [status, setStatus] = useState("active");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!organizationId || !planId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, planId, status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to assign plan.");
      setMessage("Plan assigned successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign plan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-form-grid">
      <label>Organization<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Plan<select value={planId} onChange={(event) => setPlanId(event.target.value)}>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="trialing">Trialing</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></label>
      <button className="admin-button" type="button" onClick={save} disabled={saving || !organizationId || !planId}>{saving ? "Assigning..." : "Assign plan"}</button>
      {message ? <p className="admin-form-message">{message}</p> : null}
    </div>
  );
}
