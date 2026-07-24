"use client";

import { useState } from "react";
import type { WorkflowRecord } from "@/lib/workflow-registry";

type N8nWorkflow = { id: string; name: string; active: boolean; editor_url?: string };
type Props = { workflows: N8nWorkflow[]; registeredWorkflows: WorkflowRecord[]; configured: boolean };

function workflowKey(name: string, id: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || `n8n-${id}`;
}

export default function N8nDiscoveryClient({ workflows, registeredWorkflows, configured }: Props) {
  const [registeredIds, setRegisteredIds] = useState(() => new Set(registeredWorkflows.map((item) => item.external_workflow_id).filter(Boolean)));
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

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
          description: "Imported from the connected n8n workspace.",
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

  return (
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>n8n discovery</h2>
          <p>{configured ? "Open workflows in n8n or import them into the Fluxknight registry." : "Add n8n environment variables to enable workflow discovery."}</p>
        </div>
      </div>
      {message ? <p className="admin-form-message">{message}</p> : null}
      <div className="admin-list">
        {workflows.map((workflow) => {
          const imported = registeredIds.has(workflow.id);
          return (
            <div key={workflow.id} className="admin-list-row">
              <div>
                <strong>{workflow.name}</strong>
                <span>External ID: {workflow.id}</span>
                <span>{imported ? "Managed in Fluxknight registry" : "Discovered from n8n"}</span>
              </div>
              <div className="admin-row-actions">
                <em className={workflow.active ? "good" : "muted"}>{workflow.active ? "active" : "inactive"}</em>
                {workflow.editor_url ? <a className="admin-button secondary" href={workflow.editor_url} target="_blank" rel="noreferrer">Open in n8n</a> : null}
                <button className="admin-button" type="button" disabled={imported || busyId === workflow.id} onClick={() => importWorkflow(workflow)}>
                  {busyId === workflow.id ? "Importing..." : imported ? "Imported" : "Import"}
                </button>
              </div>
            </div>
          );
        })}
        {!workflows.length ? <p>No n8n workflows discovered yet.</p> : null}
      </div>
    </section>
  );
}
