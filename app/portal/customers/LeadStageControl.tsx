"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const stages = [
  ["new", "New enquiry"],
  ["qualified", "Qualified"],
  ["contacted", "Contacted"],
  ["nurturing", "Follow-up"],
  ["appointment", "Appointment"],
  ["won", "Won"],
  ["lost", "Lost"],
  ["disqualified", "Disqualified"],
] as const;

export default function LeadStageControl({ leadId, stage, canManage }: { leadId: string; stage: string; canManage: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(stage || "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/portal/leads/" + leadId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to update enquiry stage.");
      router.refresh();
    } catch (cause) {
      setValue(previous);
      setError(cause instanceof Error ? cause.message : "Unable to update enquiry stage.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="portal-field">
    <label htmlFor={"lead-stage-" + leadId}>Pipeline stage</label>
    <select id={"lead-stage-" + leadId} value={value} disabled={!canManage || busy} onChange={(event) => void change(event.target.value)}>
      {stages.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
    {error ? <small role="alert">{error}</small> : null}
  </div>;
}
