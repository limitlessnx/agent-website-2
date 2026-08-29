"use client";

import Link from "next/link";
import { useState } from "react";
import type { LeoPersistedSignal } from "@/lib/leo-proactive-signal-store";

export default function LeoProactiveSignals({ initialSignals }: { initialSignals: LeoPersistedSignal[] }) {
  const [signals, setSignals] = useState(initialSignals);
  const [busy, setBusy] = useState<string | null>(null);

  async function acknowledge(signalId: string) {
    setBusy(signalId);
    try {
      const response = await fetch("/api/leo/monitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "acknowledge", signalId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.signal) return;
      setSignals((current) => current.map((item) => item.id === signalId ? payload.signal as LeoPersistedSignal : item));
    } finally {
      setBusy(null);
    }
  }

  if (!signals.length) return <p className="admin-empty">No proactive operational signal currently requires attention.</p>;

  return <div className="admin-list">
    {signals.map((item) => <div key={item.id} className="admin-list-row">
      <Link href={item.href} style={{ minWidth: 0, flex: 1, textDecoration: "none", color: "inherit" }}>
        <div><strong>{item.title}</strong><span>{item.summary} {item.recommendation}</span></div>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <em>{item.severity} · {item.lifecycle}</em>
        {item.lifecycle !== "acknowledged" ? <button type="button" onClick={() => void acknowledge(item.id)} disabled={busy === item.id} style={{ border: "1px solid currentColor", borderRadius: 8, padding: "6px 10px", background: "transparent", color: "inherit", cursor: busy === item.id ? "wait" : "pointer", opacity: busy === item.id ? 0.6 : 1 }}>{busy === item.id ? "Saving…" : "Acknowledge"}</button> : null}
      </div>
    </div>)}
  </div>;
}
