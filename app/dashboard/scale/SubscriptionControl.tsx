"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

export default function SubscriptionControl({ organizations, plans, initialPlanId, requireConfirmation = false, onSavingChange }: { organizations: Option[]; plans: Option[]; initialPlanId?: string; requireConfirmation?: boolean; onSavingChange?: (saving: boolean) => void }) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id || "");
  const [planId, setPlanId] = useState(initialPlanId === undefined ? plans[0]?.id || "" : initialPlanId);
  const [status, setStatus] = useState("active");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!organizationId || !planId || (requireConfirmation && !confirmed)) return;
    setSaving(true);
    onSavingChange?.(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, planId, status }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to assign plan.");
      setMessage(result.warning || "Plan assigned successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign plan.");
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  return (
    <div className="admin-form-grid">
      <label>Organization<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Plan<select value={planId} onChange={(event) => { setPlanId(event.target.value); setConfirmed(false); }}><option value="" disabled>Select a plan</option>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active</option><option value="trialing">Trialing</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select></label>
      {requireConfirmation ? <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I confirm this manual plan change; no payment is collected.</label> : null}
      <button className="admin-button" type="button" onClick={save} disabled={saving || !organizationId || !planId || (requireConfirmation && !confirmed)}>{saving ? "Assigning..." : requireConfirmation ? "Save manual upgrade" : "Assign plan"}</button>
      {message ? <p className="admin-form-message" role="status">{message}</p> : null}
    </div>
  );
}
