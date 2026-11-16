"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Loader2, Rocket } from "@/components/admin/ServerIcons";

type TemplateOption = {
  slug: string;
  name: string;
  industry: string;
  description: string | null;
};

type ProvisionResult = {
  organization_id?: string;
  organization_name?: string;
  organization_slug?: string;
  template_slug?: string;
  provisioning?: {
    agents_created?: number;
    workflows_created?: number;
    knowledge_collections_created?: number;
    integrations_created?: number;
  };
};

export default function OrganizationCreationWizard({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const pendingRequest = useRef<{ id: string; payload: string } | null>(null);
  const [name, setName] = useState("");
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "");
  const [industry, setIndustry] = useState(templates[0]?.industry || "");
  const [businessEmail, setBusinessEmail] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [provisioning, setProvisioning] = useState<{ status?: string; message?: string } | null>(null);
  const [result, setResult] = useState<ProvisionResult | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.slug === templateSlug),
    [templateSlug, templates],
  );

  function selectTemplate(slug: string) {
    setTemplateSlug(slug);
    const template = templates.find((item) => item.slug === slug);
    if (template) setIndustry(template.industry);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || result) return;
    setSaving(true);
    setError("");
    setResult(null);

    try {
      const input = { name, templateSlug, industry, businessEmail, country, timezone };
      const serialized = JSON.stringify(input);
      // Retain the request across a lost response and reload; never reuse it for changed input.
      let pending = pendingRequest.current;
      if (!pending) {
        try { pending = JSON.parse(sessionStorage.getItem("fluxknight-organization-creation") || "null"); } catch { /* Storage can be unavailable. */ }
      }
      if (!pending || pending.payload !== serialized) pending = { id: crypto.randomUUID(), payload: serialized };
      pendingRequest.current = pending;
      try { sessionStorage.setItem("fluxknight-organization-creation", JSON.stringify(pending)); } catch { /* In-memory retries still use the same ID. */ }
      const response = await fetch("/api/admin/organizations/create-and-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, requestId: pending.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to create organization.");

      setResult(payload.result || {});
      setProvisioning(payload.provisioning || { status: "needs_attention", message: "Organization saved. Review setup to confirm provisioning." });
      setName("");
      setBusinessEmail("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create organization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Create and provision organization</h2>
          <p>Create the tenant and starter workspace, then track automation setup separately.</p>
        </div>
        <span className={templates.length ? "admin-status live" : "admin-status warning"}>
          {templates.length ? "Provisioning ready" : "No templates"}
        </span>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Organization name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="PrimeHomes Realty"
              style={{ padding: "11px 12px", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Business email</span>
            <input
              type="email"
              value={businessEmail}
              onChange={(event) => setBusinessEmail(event.target.value)}
              placeholder="operations@company.com"
              style={{ padding: "11px 12px", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Template</span>
            <select
              required
              value={templateSlug}
              onChange={(event) => selectTemplate(event.target.value)}
              style={{ padding: "11px 12px", borderRadius: 10 }}
            >
              {templates.map((template) => (
                <option key={template.slug} value={template.slug}>{template.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Industry</span><small id="industry-template-note">Set by the selected template</small>
            <input
              value={industry}
              readOnly
              aria-describedby="industry-template-note"
              placeholder="Real Estate"
              style={{ padding: "11px 12px", borderRadius: 10 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Country</span>
            <input value={country} onChange={(event) => setCountry(event.target.value)} style={{ padding: "11px 12px", borderRadius: 10 }} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Timezone</span>
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} style={{ padding: "11px 12px", borderRadius: 10 }} />
          </label>
        </div>

        {selectedTemplate ? (
          <div className="admin-list-row compact">
            <div>
              <strong><Building2 size={14} /> {selectedTemplate.name}</strong>
              <span>{selectedTemplate.description || `${selectedTemplate.industry} starter workspace`}</span>
            </div>
            <em>{selectedTemplate.industry}</em>
          </div>
        ) : null}

        {error ? <div className="admin-list-row attention-danger"><div><strong>Provisioning failed</strong><span>{error}</span></div><em>error</em></div> : null}

        {result ? (
          <div className="admin-list-row" style={{ flexWrap: "wrap", overflowWrap: "anywhere" }}>
            <div>
              <strong><CheckCircle2 size={15} /> {result.organization_name || "Organization created"}</strong>
              <span>Workspace slug: {result.organization_slug || "created"}</span>
              <span>
                {result.provisioning?.agents_created || 0} agents · {result.provisioning?.workflows_created || 0} workflows · {result.provisioning?.knowledge_collections_created || 0} knowledge collections · {result.provisioning?.integrations_created || 0} integrations
              </span>
            </div>
            <span className="admin-status warning">{provisioning?.status === "provisioning_in_progress" ? "Provisioning in progress" : provisioning?.status === "awaiting_customer_configuration" ? "Awaiting customer configuration" : "Needs attention"}</span>
          </div>
        ) : null}

        {result ? <div role="status" aria-live="polite"><p>{provisioning?.message}</p>{result.organization_id ? <Link className="admin-button secondary" href={`/dashboard/clients/${encodeURIComponent(result.organization_id)}/setup`}>Continue saved organization setup</Link> : null}<button type="button" className="admin-button secondary" onClick={() => { setResult(null); setProvisioning(null); pendingRequest.current = null; try { sessionStorage.removeItem("fluxknight-organization-creation"); } catch {} }}>Create another organization</button></div> : null}
        <div>
          <button type="submit" disabled={saving || Boolean(result) || !templates.length} className="admin-primary-button">
            {saving ? <Loader2 size={16} className="spin" /> : <Rocket size={16} />}
            {saving ? "Creating workspace..." : "Create and provision workspace"}
          </button>
        </div>
      </form>
    </section>
  );
}
