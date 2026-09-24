"use client";

import { useState } from "react";

type ReadinessCheck = { key: string; ok: boolean; detail: string };
type Readiness = {
  configured?: boolean;
  credentialSource?: string;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  accountStatus?: string | null;
  readyForCutover?: boolean;
  checks?: ReadinessCheck[];
};

export default function WhatsAppIntegrationPanel({
  organizationName,
  initialReadiness,
  initiallyActive = false,
}: {
  organizationName: string;
  initialReadiness: Readiness;
  initiallyActive?: boolean;
}) {
  const [readiness, setReadiness] = useState<Readiness>(initialReadiness || {});
  const [active, setActive] = useState(initiallyActive);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      phoneNumberId: String(form.get("phoneNumberId") || "").trim(),
      accessToken: String(form.get("accessToken") || "").trim(),
      wabaId: String(form.get("wabaId") || "").trim(),
      graphVersion: String(form.get("graphVersion") || "v23.0").trim(),
    };

    try {
      const response = await fetch("/api/integrations/whatsapp/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save WhatsApp credentials.");
      setReadiness(result.readiness || {});
      setActive(false);
      setMessage(result.readiness?.readyForCutover
        ? "Credentials saved and verified. WhatsApp is ready to activate for Maia."
        : "Credentials saved. Complete the remaining readiness checks before activation.");
      const tokenInput = event.currentTarget.elements.namedItem("accessToken") as HTMLInputElement | null;
      if (tokenInput) tokenInput.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save WhatsApp credentials.");
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    setActivating(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/integrations/whatsapp/activate", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to activate WhatsApp.");
      setReadiness(result.readiness?.whatsapp || readiness);
      setActive(true);
      setMessage("WhatsApp is active for Maia on this workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate WhatsApp.");
    } finally {
      setActivating(false);
    }
  }

  const statusLabel = active
    ? "Active"
    : readiness.readyForCutover
      ? "Ready to activate"
      : readiness.configured
        ? "Needs attention"
        : "Not connected";

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <p className="admin-kicker">Customer channel</p>
          <h2>WhatsApp</h2>
          <p>Connect {organizationName}&apos;s WhatsApp Business number to Maia. Credentials are stored securely and are never displayed again.</p>
        </div>
        <span className={active ? "admin-status live" : readiness.readyForCutover ? "admin-status live" : "admin-status warning"}>
          {statusLabel}
        </span>
      </div>

      {message ? <div className="admin-notice success" style={{ marginBottom: 18 }}>{message}</div> : null}
      {error ? <div className="admin-notice error" style={{ marginBottom: 18 }}>{error}</div> : null}

      <div className="admin-grid two" style={{ alignItems: "start" }}>
        <form onSubmit={saveCredentials} className="admin-form" style={{ display: "grid", gap: 16 }}>
          <label>
            <span>WhatsApp Phone Number ID</span>
            <input
              name="phoneNumberId"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              defaultValue={readiness.phoneNumberId || ""}
              placeholder="Meta Phone Number ID"
            />
          </label>
          <label>
            <span>Permanent Access Token</span>
            <input
              name="accessToken"
              type="password"
              autoComplete="new-password"
              required={!readiness.configured}
              placeholder={readiness.configured ? "Enter a new token only to replace the stored token" : "Permanent Meta access token"}
            />
          </label>
          <label>
            <span>WhatsApp Business Account ID</span>
            <input name="wabaId" type="text" inputMode="numeric" autoComplete="off" placeholder="WABA ID" />
          </label>
          <label>
            <span>Meta Graph API Version</span>
            <input name="graphVersion" type="text" autoComplete="off" defaultValue="v23.0" />
          </label>
          <div>
            <button className="admin-btn primary" type="submit" disabled={saving}>
              {saving ? "Saving & verifying..." : readiness.configured ? "Update & verify" : "Save & verify"}
            </button>
          </div>
        </form>

        <div className="admin-list">
          <div className="admin-list-row">
            <div><strong>Business number</strong><span>{readiness.displayPhoneNumber || "Not verified yet"}</span></div>
            <em>{readiness.displayPhoneNumber ? "verified" : "pending"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Verified business</strong><span>{readiness.verifiedName || "Waiting for Meta verification"}</span></div>
            <em>{readiness.accountStatus || "pending"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Quality rating</strong><span>Meta WhatsApp number health</span></div>
            <em>{readiness.qualityRating || "unknown"}</em>
          </div>
          <div className="admin-list-row">
            <div><strong>Credential storage</strong><span>Tenant-isolated secure credential record</span></div>
            <em>{readiness.credentialSource === "tenant_vault" ? "vault" : readiness.credentialSource || "pending"}</em>
          </div>
          {(readiness.checks || []).map((check) => (
            <div className="admin-list-row" key={check.key}>
              <div><strong>{check.key.replaceAll("_", " ")}</strong><span>{check.detail}</span></div>
              <em className={check.ok ? "good" : "bad"}>{check.ok ? "ready" : "required"}</em>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="admin-btn primary"
          type="button"
          onClick={activate}
          disabled={!readiness.readyForCutover || active || activating}
        >
          {activating ? "Activating..." : active ? "WhatsApp active" : "Activate WhatsApp for Maia"}
        </button>
        <span style={{ opacity: .72, fontSize: 13 }}>
          Activation is enabled only after Meta credentials and webhook readiness pass.
        </span>
      </div>
    </section>
  );
}
