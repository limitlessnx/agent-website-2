"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Loader2, Rocket } from "lucide-react";

type TemplateOption = {
  slug: string;
  name: string;
  industry: string;
  description: string | null;
};

type ProvisionResult = {
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
  const [name, setName] = useState("");
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "");
  const [industry, setIndustry] = useState(templates[0]?.industry || "");
  const [businessEmail, setBusinessEmail] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [timezone, setTimezone] = useState("Africa/Lagos");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    setSaving(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/admin/organizations/create-and-provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, templateSlug, industry, businessEmail, country, timezone }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to create organization.");

      setResult(payload.result || {});
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
          <p>Create the tenant and its starter workspace in one atomic operation.</p>
        </div>
        <span className={templates.length ? "admin-status live" : "admin-status warning"}>
          {templates.length ? "Provisioning ready" : "No templates"}
        </span>
      </div>

      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
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
            <span>Industry</span>
            <input
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
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
          <div className="admin-list-row">
            <div>
              <strong><CheckCircle2 size={15} /> {result.organization_name || "Organization created"}</strong>
              <span>Workspace slug: {result.organization_slug || "created"}</span>
              <span>
                {result.provisioning?.agents_created || 0} agents · {result.provisioning?.workflows_created || 0} workflows · {result.provisioning?.knowledge_collections_created || 0} knowledge collections · {result.provisioning?.integrations_created || 0} integrations
              </span>
            </div>
            <em className="good">ready</em>
          </div>
        ) : null}

        <div>
          <button type="submit" disabled={saving || !templates.length} className="admin-primary-button">
            {saving ? <Loader2 size={16} className="spin" /> : <Rocket size={16} />}
            {saving ? "Creating workspace..." : "Create and provision workspace"}
          </button>
        </div>
      </form>
    </section>
  );
}
