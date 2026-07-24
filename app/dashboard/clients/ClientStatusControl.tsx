"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const options = [
  ["submitted", "Submitted"],
  ["configuration", "Configuration"],
  ["testing", "Testing"],
  ["awaiting_approval", "Awaiting approval"],
  ["live", "Live"],
  ["paused", "Paused"],
];

export default function ClientStatusControl({ id, value }: { id: string; value: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(value === "in_progress" ? "submitted" : value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: string) {
    setStatus(nextStatus);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/clients/onboarding-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to update status.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 5, minWidth: 150 }}>
      <select
        aria-label="Update onboarding status"
        value={status}
        disabled={saving}
        onChange={(event) => updateStatus(event.target.value)}
        style={{ width: "100%", padding: "8px 9px", borderRadius: 9, border: "1px solid rgba(180,139,255,.18)", background: "rgba(7,4,15,.8)", color: "inherit" }}
      >
        {options.map(([optionValue, label]) => <option key={optionValue} value={optionValue}>{label}</option>)}
      </select>
      {error ? <small style={{ color: "#fb7185" }}>{error}</small> : <small style={{ color: "#756a85" }}>{saving ? "Saving..." : "Admin controlled"}</small>}
    </div>
  );
}
