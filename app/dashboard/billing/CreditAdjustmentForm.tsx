"use client";

import { useState, type FormEvent } from "react";
import styles from "./BillingOperations.module.css";

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
    <form className={styles.adjustPanel} onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <strong>Credit adjustment</strong>
      <p className={styles.adjustHint}>Manual changes are internal controls. Use them only when there is a clear operational or commercial reason.</p>
      <div className={styles.adjustGrid}>
        <label className={styles.field}>
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="adjustment">Adjustment</option>
            <option value="bonus">Bonus credits</option>
            <option value="top_up">Top-up credits</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Credits</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="1000 or -250" />
        </label>
        <label className={styles.field}>
          <span>Reason</span>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Operational or commercial reason" />
        </label>
        <button className={styles.submit} type="submit">Apply change</button>
      </div>
      {status ? <p className={styles.feedback}>{status}</p> : null}
    </form>
  );
}
