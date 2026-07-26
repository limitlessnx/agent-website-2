"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TemplateOption = {
  slug: string;
  name: string;
};

export default function TemplateProvisionControl({
  organizationId,
  templates,
}: {
  organizationId: string;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function provision() {
    if (!templateSlug) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/organizations/provision-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, templateSlug }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to provision template.");
      setMessage("Provisioned");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to provision template.");
    } finally {
      setSaving(false);
    }
  }

  if (!templates.length) return <small style={{ color: "#756a85" }}>No active templates</small>;

  return (
    <div style={{ display: "grid", gap: 6, minWidth: 210 }}>
      <select
        aria-label="Select organization template"
        value={templateSlug}
        disabled={saving}
        onChange={(event) => setTemplateSlug(event.target.value)}
        style={{ width: "100%", padding: "8px 9px", borderRadius: 9, border: "1px solid rgba(180,139,255,.18)", background: "rgba(7,4,15,.8)", color: "inherit" }}
      >
        {templates.map((template) => <option key={template.slug} value={template.slug}>{template.name}</option>)}
      </select>
      <button
        type="button"
        disabled={saving || !templateSlug}
        onClick={provision}
        style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(88,223,255,.24)", background: "rgba(37,180,210,.12)", color: "inherit", cursor: saving ? "wait" : "pointer" }}
      >
        {saving ? "Provisioning..." : "Provision workspace"}
      </button>
      {error ? <small style={{ color: "#fb7185" }}>{error}</small> : <small style={{ color: message ? "#34d399" : "#756a85" }}>{message || "Idempotent and safe to rerun"}</small>}
    </div>
  );
}
