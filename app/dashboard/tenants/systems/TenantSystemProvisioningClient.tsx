"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Installation = {
  id: string;
  status: string;
  requested_at: string;
  activated_at?: string | null;
  last_error?: string | null;
  organizations: { name?: string; slug?: string } | { name?: string; slug?: string }[] | null;
  system_catalog: { name?: string; slug?: string; category?: string } | { name?: string; slug?: string; category?: string }[] | null;
};

function relation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default function TenantSystemProvisioningClient({ installations }: { installations: Installation[] }) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState("");
  const [message, setMessage] = useState("");

  async function provision(id: string) {
    setWorkingId(id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/tenant-systems/${id}/provision`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to provision this tenant system.");
      setMessage(`${result.result.system} is now ${result.result.status} for ${result.result.organization}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to provision this tenant system.");
    } finally {
      setWorkingId("");
    }
  }

  return (
    <>
      {message ? <p className="admin-form-message">{message}</p> : null}
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Tenant system requests</h2>
            <p>Approve a request to clone its dedicated backend automations into an isolated n8n tenant project.</p>
          </div>
        </div>
        <div className="admin-list">
          {installations.map((installation) => {
            const organization = relation(installation.organizations);
            const system = relation(installation.system_catalog);
            const canProvision = ["setup_required", "awaiting_approval", "needs_attention", "paused"].includes(installation.status);
            return (
              <div className="admin-list-row" key={installation.id}>
                <div>
                  <strong>{organization?.name || "Unknown organization"} · {system?.name || "Unknown system"}</strong>
                  <span>{system?.category || "system"} · requested {new Date(installation.requested_at).toLocaleString()}</span>
                  <span>{installation.last_error || "Dedicated tenant automations remain hidden from the client dashboard."}</span>
                </div>
                <div className="admin-inline-actions">
                  <em className={installation.status === "active" ? "good" : installation.status === "needs_attention" ? "bad" : "muted"}>
                    {installation.status.replaceAll("_", " ")}
                  </em>
                  {canProvision ? (
                    <button
                      className="admin-button"
                      type="button"
                      disabled={workingId === installation.id}
                      onClick={() => provision(installation.id)}
                    >
                      {workingId === installation.id ? "Provisioning..." : installation.status === "needs_attention" ? "Retry provisioning" : "Approve and provision"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!installations.length ? <p className="admin-empty">No tenant systems have been requested yet.</p> : null}
        </div>
      </section>
    </>
  );
}
