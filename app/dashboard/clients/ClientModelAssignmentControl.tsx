"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ModelOption = {
  id: string;
  provider: string;
  model_key: string;
  display_name: string;
};

export default function ClientModelAssignmentControl({
  organizationId,
  models,
  currentModelId,
}: {
  organizationId: string;
  models: ModelOption[];
  currentModelId?: string | null;
}) {
  const router = useRouter();
  const [modelId, setModelId] = useState(currentModelId || models[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    if (!modelId) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_model", organizationId, modelId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to assign AI model.");
      setMessage("Organization AI model assigned.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign AI model.");
    } finally {
      setSaving(false);
    }
  }

  if (!models.length) {
    return (
      <div className="admin-list-row">
        <div style={{ flex: 1 }}>
          <strong>No active AI models registered</strong>
          <span>Register the approved provider models first, then return here to assign one to this organization.</span>
        </div>
        <Link className="admin-button secondary" href="/dashboard/ai-models">Open model registry</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="admin-list-row" style={{ alignItems: "end", gap: 12 }}>
        <label style={{ flex: 1 }}>
          <span>Approved organization model</span>
          <select value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={saving} style={{ width: "100%" }}>
            {models.map((model) => (
              <option key={model.id} value={model.id}>{model.display_name} · {model.provider}</option>
            ))}
          </select>
        </label>
        <button className="admin-button" type="button" onClick={save} disabled={saving || !modelId}>
          {saving ? "Assigning..." : currentModelId ? "Update model" : "Assign model"}
        </button>
        <Link className="admin-button secondary" href="/dashboard/ai-models">Manage catalog</Link>
      </div>
      {message ? <p className="admin-form-message">{message}</p> : null}
    </div>
  );
}
