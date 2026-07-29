"use client";

import { useMemo, useState } from "react";
import type { WorkflowRecord } from "@/lib/workflow-registry";

type N8nWorkflow = { id: string; name: string; active: boolean; editor_url?: string };
type Props = { workflows: N8nWorkflow[]; registeredWorkflows: WorkflowRecord[]; configured: boolean };

function workflowKey(name: string, id: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || `automation-${id}`;
}

export default function N8nDiscoveryClient({ workflows: initialWorkflows, registeredWorkflows, configured }: Props) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [registeredIds, setRegisteredIds] = useState(() => new Set(registeredWorkflows.map((item) => item.external_workflow_id).filter(Boolean)));
  const [busyId, setBusyId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  const groupedWorkflows = useMemo(() => ({
    active: workflows.filter((workflow) => workflow.active),
    inactive: workflows.filter((workflow) => !workflow.active),
  }), [workflows]);

  async function syncN8n() {
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/n8n/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to sync automations.");

      const syncedRecords = Array.isArray(result.workflows) ? result.workflows as WorkflowRecord[] : [];
      setRegisteredIds(new Set(syncedRecords.map((item) => item.external_workflow_id).filter(Boolean)));
      setWorkflows((current) => current.map((workflow) => {
        const record = syncedRecords.find((item) => item.external_workflow_id === workflow.id);
        return record ? { ...workflow, active: record.status === "active" } : workflow;
      }));
      setMessage(`${result.synced || 0} automations synchronized.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync automations.");
    } finally {
      setSyncing(false);
    }
  }

  async function importWorkflow(workflow: N8nWorkflow) {
    setBusyId(workflow.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: "limitless-realty",
          project_id: "limitless-realty",
          workflow_key: workflowKey(workflow.name, workflow.id),
          name: workflow.name,
          description: "Imported from the connected automation engine.",
          provider: "n8n",
          external_workflow_id: workflow.id,
          status: workflow.active ? "active" : "paused",
          timeout_seconds: 60,
          max_retries: 2,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || "Unable to import workflow.");
      setRegisteredIds((current) => new Set([...current, workflow.id]));
      setMessage(`${workflow.name} imported into the registry.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import workflow.");
    } finally {
      setBusyId("");
    }
  }

  function renderWorkflow(workflow: N8nWorkflow) {
    const imported = registeredIds.has(workflow.id);
    return (
      <div key={workflow.id} className="admin-list-row">
        <div>
          <strong>{workflow.name}</strong>
          <span>External ID: {workflow.id}</span>
          <span>{imported ? "Managed in Fluxknight registry" : "Discovered from the automation engine"}</span>
        </div>
        <div className="admin-row-actions">
          <em className={workflow.active ? "good" : "muted"}>{workflow.active ? "active" : "inactive"}</em>
          {workflow.editor_url ? <a className="admin-button secondary" href={workflow.editor_url} target="_blank" rel="noreferrer">Open engine</a> : null}
          <button className="admin-button" type="button" disabled={imported || busyId === workflow.id} onClick={() => importWorkflow(workflow)}>
            {busyId === workflow.id ? "Importing..." : imported ? "Imported" : "Import"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Automation Engine</h2>
          <p>{configured ? "Automations are grouped by their current activity state." : "Add automation engine environment variables to enable discovery."}</p>
        </div>
        <button className="admin-button" type="button" disabled={!configured || syncing} onClick={syncN8n}>
          {syncing ? "Syncing..." : "Sync engine"}
        </button>
      </div>
      {message ? <p className="admin-form-message">{message}</p> : null}

      <div className="admin-list">
        <div className="admin-panel-header">
          <div>
            <h2>Active</h2>
            <p>{groupedWorkflows.active.length} automation{groupedWorkflows.active.length === 1 ? "" : "s"} currently running.</p>
          </div>
        </div>
        {groupedWorkflows.active.length ? groupedWorkflows.active.map(renderWorkflow) : <p>No active automations.</p>}
      </div>

      <div className="admin-list" style={{ marginTop: 24 }}>
        <div className="admin-panel-header">
          <div>
            <h2>Inactive</h2>
            <p>{groupedWorkflows.inactive.length} paused or inactive automation{groupedWorkflows.inactive.length === 1 ? "" : "s"}.</p>
          </div>
        </div>
        {groupedWorkflows.inactive.length ? groupedWorkflows.inactive.map(renderWorkflow) : <p>No inactive automations.</p>}
      </div>
    </section>
  );
}
