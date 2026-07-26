"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiModelCatalogItem, OrganizationModelAssignment, OrganizationOption } from "@/lib/ai-model-control";

type Props = {
  models: AiModelCatalogItem[];
  assignments: OrganizationModelAssignment[];
  organizations: OrganizationOption[];
};

export default function AiModelControl({ models, assignments, organizations }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id || "");
  const [modelId, setModelId] = useState(models.find((model) => model.status === "active")?.id || "");

  const activeModels = useMemo(() => models.filter((model) => model.status === "active"), [models]);
  const assignmentMap = useMemo(() => new Map(assignments.map((item) => [item.organization_id, item.model_id])), [assignments]);
  const modelMap = useMemo(() => new Map(models.map((item) => [item.id, item])), [models]);

  async function submit(payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update model controls.");
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update model controls.");
    } finally {
      setBusy(false);
    }
  }

  async function createModel(event: FormEvent) {
    event.preventDefault();
    await submit({ action: "create_model", provider, modelKey, displayName });
    setProvider("");
    setModelKey("");
    setDisplayName("");
  }

  async function assignModel(event: FormEvent) {
    event.preventDefault();
    await submit({ action: "assign_model", organizationId, modelId });
  }

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Supported model registry</h2><p>Only register models Fluxknight can actually provide and operate.</p></div>
          <span className="admin-status live">Super admin only</span>
        </div>
        <form onSubmit={createModel} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <label><span>Provider</span><input value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="openai" required /></label>
          <label><span>Model key</span><input value={modelKey} onChange={(event) => setModelKey(event.target.value)} placeholder="Exact provider model ID" required /></label>
          <label><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Internal display name" required /></label>
          <button type="submit" disabled={busy}>Register model</button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization assignment</h2><p>Each organization receives one centrally controlled model assignment.</p></div>
        </div>
        <form onSubmit={assignModel} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <label><span>Organization</span><select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} required>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
          <label><span>Approved model</span><select value={modelId} onChange={(event) => setModelId(event.target.value)} required><option value="">Select an active model</option>{activeModels.map((model) => <option key={model.id} value={model.id}>{model.display_name} · {model.provider}</option>)}</select></label>
          <button type="submit" disabled={busy || !activeModels.length}>Assign model</button>
        </form>
        {message ? <p className="admin-empty">{message}</p> : null}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Current organization models</h2><p>Organizations cannot alter these assignments.</p></div></div>
        <div className="admin-list">
          {organizations.map((organization) => {
            const assigned = modelMap.get(assignmentMap.get(organization.id) || "");
            return <div className="admin-list-row" key={organization.id}><div><strong>{organization.name}</strong><span>{organization.slug} · {organization.status}</span></div><em>{assigned ? `${assigned.display_name} · ${assigned.provider}` : "Not assigned"}</em></div>;
          })}
          {!organizations.length ? <p className="admin-empty">No organizations exist yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Registered models</h2><p>Disabled models remain recorded but cannot be newly assigned.</p></div></div>
        <div className="admin-list">
          {models.map((model) => <div className="admin-list-row" key={model.id}><div><strong>{model.display_name}</strong><span>{model.provider} · {model.model_key}</span></div><button type="button" disabled={busy} onClick={() => submit({ action: "set_status", modelId: model.id, status: model.status === "active" ? "disabled" : "active" })}>{model.status === "active" ? "Disable" : "Enable"}</button></div>)}
          {!models.length ? <p className="admin-empty">No models registered. Nothing is offered to organizations until you add one.</p> : null}
        </div>
      </section>
    </>
  );
}
