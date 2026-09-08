"use client";

import { useState, type FormEvent } from "react";

export default function CreditAdjustmentForm({ organizationId }: { organizationId: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState("adjustment");
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving...");
    const response = await fetch("/api/admin/billing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, amount: Number(amount), reason, type }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(result.error || "Unable to adjust credits.");
      return;
    }
    setAmount("");
    setReason("");
    setStatus("Credits adjusted. Refresh to see the updated ledger summary.");
  }

  return (
    <form className="admin-card" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <strong>Adjust credits</strong>
      <select value={type} onChange={(event) => setType(event.target.value)}>
        <option value="adjustment">Adjustment</option>
        <option value="bonus">Bonus credits</option>
        <option value="top_up">Top-up credits</option>
      </select>
      <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="Credits, e.g. 1000 or -250" />
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" />
      <button className="admin-button" type="submit">Apply credit change</button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}
