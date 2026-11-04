"use client";

import { useState } from "react";

type ProvisionedPlan = {
  slug: string;
  currency: "NGN" | "USD";
  planId: number;
  reused: boolean;
};

type ProvisionResponse = {
  ok?: boolean;
  message?: string;
  plans?: ProvisionedPlan[];
  error?: string;
  provisionedBy?: string;
};

export default function FlutterwavePlansAdminPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProvisionResponse | null>(null);

  async function provision() {
    const confirmed = window.confirm(
      "This will create any missing Fluxknight monthly plans in the configured Flutterwave account and save their IDs to Supabase. Existing matching plans will be reused. Continue?",
    );
    if (!confirmed) return;

    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/billing/flutterwave-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ confirm: "CREATE_FLUXKNIGHT_MONTHLY_PLANS" }),
      });
      const payload = (await response.json()) as ProvisionResponse;
      setResult(payload);
      if (!response.ok) {
        setResult({ ...payload, ok: false, error: payload.error || `Request failed (${response.status}).` });
      }
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : "Unable to contact the provisioning endpoint." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#090610", color: "#f7f3ff", padding: "32px 18px", fontFamily: "Arial, sans-serif" }}>
      <section style={{ maxWidth: 860, margin: "0 auto", border: "1px solid #39264f", borderRadius: 20, padding: 24, background: "linear-gradient(145deg,#160d22,#0d0914)" }}>
        <p style={{ color: "#c18cff", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Fluxknight · Super Admin</p>
        <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Flutterwave monthly plans</h1>
        <p style={{ color: "#c8bfd3", lineHeight: 1.6 }}>
          Provision and verify the six recurring payment plans used by Basic, Plus and Business subscriptions. Matching plans are reused to avoid duplicates. Provider credentials remain server-side.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, margin: "24px 0" }}>
          {[
            ["Basic", "₦50,000 / $200 monthly"],
            ["Plus", "₦100,000 / $350 monthly"],
            ["Business", "₦250,000 / $700 monthly"],
          ].map(([name, price]) => (
            <div key={name} style={{ border: "1px solid #49345f", borderRadius: 14, padding: 16, background: "#130c1d" }}>
              <strong>{name}</strong>
              <p style={{ color: "#c8bfd3", marginBottom: 0 }}>{price}</p>
            </div>
          ))}
        </div>

        <button type="button" onClick={provision} disabled={busy} style={{ border: 0, borderRadius: 12, padding: "15px 20px", width: "100%", background: busy ? "#59436e" : "linear-gradient(90deg,#9854ed,#bd76ff)", color: "white", fontSize: 16, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
          {busy ? "Provisioning and verifying plans…" : "Provision and verify all six plans"}
        </button>

        <p style={{ color: "#9d91aa", fontSize: 12, lineHeight: 1.6, marginTop: 14 }}>
          Requires an active Super Admin session. This action creates provider payment plans only; it does not charge customers or modify existing subscriptions.
        </p>

        {result && (
          <div role="status" style={{ marginTop: 22, border: `1px solid ${result.ok ? "#347a58" : "#9a4c59"}`, borderRadius: 14, padding: 16, background: result.ok ? "#102219" : "#29131a" }}>
            <h2 style={{ fontSize: 18, marginTop: 0 }}>{result.ok ? "Provisioning completed" : "Provisioning needs attention"}</h2>
            <p style={{ color: "#ddd3e6", lineHeight: 1.5 }}>{result.message || result.error}</p>
            {result.plans?.length ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                  <thead><tr><th style={{ padding: 9 }}>Plan</th><th style={{ padding: 9 }}>Currency</th><th style={{ padding: 9 }}>Flutterwave ID</th><th style={{ padding: 9 }}>Result</th></tr></thead>
                  <tbody>{result.plans.map((plan) => (
                    <tr key={`${plan.slug}-${plan.currency}`}>
                      <td style={{ padding: 9, borderTop: "1px solid #493b50" }}>{plan.slug}</td>
                      <td style={{ padding: 9, borderTop: "1px solid #493b50" }}>{plan.currency}</td>
                      <td style={{ padding: 9, borderTop: "1px solid #493b50", fontVariantNumeric: "tabular-nums" }}>{plan.planId}</td>
                      <td style={{ padding: 9, borderTop: "1px solid #493b50" }}>{plan.reused ? "Reused + verified" : "Created + verified"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : null}
            {result.provisionedBy ? <p style={{ color: "#bfb2ca", fontSize: 12 }}>Provisioned by {result.provisionedBy}</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}
