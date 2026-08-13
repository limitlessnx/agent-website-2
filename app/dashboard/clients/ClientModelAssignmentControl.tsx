"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, Check } from "@/components/admin/ServerIcons";

type ModelOption = {
  id: string;
  provider: string;
  model_key: string;
  display_name: string;
};

export default function ClientModelAssignmentControl({
  organizationId,
  models,
  currentModelIds,
}: {
  organizationId: string;
  models: ModelOption[];
  currentModelIds?: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(currentModelIds || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function toggle(modelId: string) {
    setSelected((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId],
    );
  }

  async function save() {
    if (!selected.length) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_models", organizationId, modelIds: selected }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to assign AI models.");
      setMessage(`${selected.length} AI model${selected.length === 1 ? "" : "s"} assigned to this organization.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign AI models.");
    } finally {
      setSaving(false);
    }
  }

  if (!models.length) {
    return (
      <div className="admin-list-row">
        <div style={{ flex: 1 }}>
          <strong>No active AI models registered</strong>
          <span>Register approved provider models first. Model count is not restricted by the client plan.</span>
        </div>
        <Link className="admin-button secondary" href="/dashboard/ai-models">Open model registry</Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <p className="admin-form-message" style={{ margin: 0 }}>
        Select one or more AI models for this organization. Model assignment is controlled by Super Admin and is independent of the client plan.
      </p>
      <div className="admin-list">
        {models.map((model) => {
          const active = selected.includes(model.id);
          return (
            <button
              key={model.id}
              type="button"
              className={`admin-list-row compact ${active ? "selected" : ""}`}
              onClick={() => toggle(model.id)}
              disabled={saving}
              style={{ width: "100%", textAlign: "left" }}
            >
              <span>{active ? <Check size={15} /> : <BrainCircuit size={15} />}</span>
              <div style={{ flex: 1 }}>
                <strong>{model.display_name}</strong>
                <span>{model.provider} · {model.model_key}</span>
              </div>
              <em>{active ? "assigned" : "available"}</em>
            </button>
          );
        })}
      </div>
      <div className="admin-list-row compact">
        <div style={{ flex: 1 }}>
          <strong>{selected.length} model{selected.length === 1 ? "" : "s"} selected</strong>
          <span>These become approved model options for this tenant's agents.</span>
        </div>
        <button className="admin-button" type="button" onClick={save} disabled={saving || !selected.length}>
          {saving ? "Saving..." : "Save model access"}
        </button>
        <Link className="admin-button secondary" href="/dashboard/ai-models">Manage catalog</Link>
      </div>
      {message ? <p className="admin-form-message">{message}</p> : null}
    </div>
  );
}
