"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type Package = { id: string; name: string; slug: string; currency: string; billing_interval: string };
type Submission = {
  id: string;
  purchaser_email: string;
  status: string;
  created_at: string;
  submitted_at?: string | null;
  business_information?: Record<string, unknown>;
  service_packages?: Package;
  organizations?: { id: string; name: string; slug: string; status: string } | null;
};
type ClientProfile = {
  id: string;
  organization_id: string;
  status: string;
  business_name: string | null;
  industry: string | null;
  ai_requirements: string | null;
  business_knowledge: Record<string, unknown>;
  whatsapp_preferences: { connection_path?: string; preferred_number?: string };
  created_at: string;
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function profileReady(profile: ClientProfile) {
  const knowledge = profile.business_knowledge || {};
  return Boolean(profile.business_name && profile.ai_requirements && Object.keys(knowledge).length);
}

export default function OnboardingQueueClient({ packages }: { packages: Package[] }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
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
      setProfiles(result.clientProfiles || []);
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
          paymentProvider: "manual",
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
      setMessage(error instanceof Error ? error.message : "Unable to create onboarding invitation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Clients awaiting setup</h2>
            <p>Only the information needed to start configuration is shown here. Technical provisioning stays behind the scenes.</p>
          </div>
          <button className="admin-button secondary" type="button" onClick={load} disabled={loading}>Refresh</button>
        </div>

        {message ? <p className="admin-form-message">{message}</p> : null}

        <div className="admin-list">
          {profiles.filter((profile) => ["submitted", "configuration", "testing", "awaiting_approval"].includes(profile.status)).map((profile) => (
            <div className="admin-list-row" key={`profile-${profile.id}`}>
              <div>
                <strong>{profile.business_name || "Unnamed business"}</strong>
                <span>{profile.industry || "Business type not provided"} · AI setup brief submitted</span>
                <span>
                  AI: {profile.ai_requirements ? "defined" : "needs review"} · Knowledge: {profileReady(profile) ? "provided" : "needs review"} · WhatsApp: {profile.whatsapp_preferences?.preferred_number || "awaiting connection"}
                </span>
              </div>
              <div className="admin-inline-actions">
                <em className={profile.status === "testing" ? "good" : "muted"}>{statusLabel(profile.status)}</em>
                <Link className="admin-button secondary" href={`/dashboard/clients/${encodeURIComponent(profile.organization_id)}/setup`}>Open setup</Link>
              </div>
            </div>
          ))}

          {submissions.map((item) => (
            <div className="admin-list-row" key={`legacy-${item.id}`}>
              <div>
                <strong>{String(item.business_information?.businessName || item.organizations?.name || item.purchaser_email)}</strong>
                <span>{item.service_packages?.name || "Package unavailable"} · Legacy managed onboarding</span>
                <span>Status: {statusLabel(item.status)}</span>
              </div>
              <div className="admin-inline-actions">
                <em className={item.status === "live" ? "good" : "muted"}>{statusLabel(item.status)}</em>
                <Link className="admin-button secondary" href={`/dashboard/onboarding/${item.id}`}>Open</Link>
              </div>
            </div>
          ))}

          {!loading && !profiles.length && !submissions.length ? <p className="admin-empty">No clients are waiting for setup.</p> : null}
          {loading ? <p className="admin-empty">Loading clients...</p> : null}
        </div>
      </section>

      <details className="admin-panel">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Create a managed onboarding link</summary>
        <form className="admin-form" onSubmit={createInvitation} style={{ marginTop: 16 }}>
          <div className="admin-form-grid">
            <label>Client email<input required name="purchaserEmail" type="email" /></label>
            <label>Package<select required name="packageId" defaultValue=""><option value="" disabled>Select package</option>{packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Payment reference<input name="paymentReference" placeholder="Optional" /></label>
          </div>
          <button className="admin-button" disabled={saving} type="submit">{saving ? "Creating..." : "Create onboarding link"}</button>
        </form>
        {invitation ? <div className="admin-list-row"><div><strong>Secure onboarding link</strong><span style={{ overflowWrap: "anywhere" }}>{invitation}</span></div><button className="admin-button secondary" type="button" onClick={() => navigator.clipboard.writeText(invitation)}>Copy link</button></div> : null}
      </details>
    </>
  );
}
