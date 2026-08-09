"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Package = { id: string; name: string; slug: string; currency: string; billing_interval: string };
type Submission = {
  id: string;
  purchaser_email: string;
  payment_status: string;
  status: string;
  current_step: number;
  created_at: string;
  submitted_at?: string | null;
  business_information?: Record<string, unknown>;
  service_packages?: Package;
  organizations?: { id: string; name: string; slug: string; status: string } | null;
};

export default function OnboardingQueueClient({ packages }: { packages: Package[] }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [invitation, setInvitation] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/onboarding", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load onboarding queue.");
      setSubmissions(result.submissions || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load onboarding queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setInvitation("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_invitation",
          purchaserEmail: data.get("purchaserEmail"),
          packageId: data.get("packageId"),
          paymentProvider: data.get("paymentProvider") || "manual",
          paymentReference: data.get("paymentReference"),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to create invitation.");
      const url = `${window.location.origin}/managed-onboarding?id=${encodeURIComponent(result.onboardingId)}&token=${encodeURIComponent(result.accessToken)}`;
      setInvitation(url);
      setMessage("Secure onboarding invitation created.");
      event.currentTarget.reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invitation.");
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => ({
    total: submissions.length,
    submitted: submissions.filter((item) => item.status === "submitted").length,
    active: submissions.filter((item) => ["under_review", "provisioning", "internal_testing"].includes(item.status)).length,
    live: submissions.filter((item) => item.status === "live").length,
  }), [submissions]);

  function businessName(item: Submission) {
    return String(item.business_information?.businessName || item.organizations?.name || "Not provided yet");
  }

  return (
    <>
      <section className="admin-stat-grid">
        <article className="admin-stat-card"><span>Total onboarding records</span><strong>{counts.total}</strong></article>
        <article className="admin-stat-card"><span>Awaiting review</span><strong>{counts.submitted}</strong></article>
        <article className="admin-stat-card"><span>In delivery</span><strong>{counts.active}</strong></article>
        <article className="admin-stat-card"><span>Live workspaces</span><strong>{counts.live}</strong></article>
      </section>

      <section id="new-client" className="admin-panel">
        <div className="admin-panel-header"><div><h2>New client</h2><p>Create the secure intake link after payment is confirmed. Technical setup remains inside Fluxknight.</p></div></div>
        <form className="admin-form" onSubmit={createInvitation}>
          <div className="admin-form-grid">
            <label>Client email<input required name="purchaserEmail" type="email" /></label>
            <label>Package<select required name="packageId" defaultValue=""><option value="" disabled>Select package</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Payment provider<input name="paymentProvider" defaultValue="manual" /></label>
            <label>Payment reference<input name="paymentReference" placeholder="Optional for manual payments" /></label>
          </div>
          <button className="admin-button" disabled={saving} type="submit">{saving ? "Creating..." : "Create onboarding link"}</button>
        </form>
        {invitation ? <div className="admin-list-row"><div><strong>Secure onboarding link</strong><span style={{ overflowWrap: "anywhere" }}>{invitation}</span></div><button className="admin-button secondary" type="button" onClick={() => navigator.clipboard.writeText(invitation)}>Copy link</button></div> : null}
        {message ? <p className="admin-form-message">{message}</p> : null}
      </section>

      <section id="queue" className="admin-panel">
        <div className="admin-panel-header"><div><h2>Onboarding queue</h2><p>Every new client stays here from intake through review, setup, testing, and activation.</p></div></div>
        <div className="admin-list">
          {loading ? <p>Loading onboarding queue...</p> : submissions.map((item) => (
            <div className="admin-list-row" key={item.id}>
              <div>
                <strong>{businessName(item)}</strong>
                <span>{item.purchaser_email} · {item.service_packages?.name || "Package unavailable"}</span>
                <span>Created {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))} · Step {item.current_step}/6</span>
              </div>
              <div className="admin-inline-actions">
                <em className={item.status === "live" ? "good" : item.status === "submitted" ? "bad" : "muted"}>{item.status.replaceAll("_", " ")}</em>
                <Link className="admin-button secondary" href={`/dashboard/onboarding/${item.id}`}>Open</Link>
              </div>
            </div>
          ))}
          {!loading && !submissions.length ? <p>No onboarding records yet.</p> : null}
        </div>
      </section>
    </>
  );
}
