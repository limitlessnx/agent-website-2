"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkflowRecord, WorkflowRun } from "@/lib/workflow-registry";

type Props = {
  initialWorkflows: WorkflowRecord[];
  initialRuns: WorkflowRun[];
  configured: boolean;
};

const providers = ["n8n", "trigger.dev", "telegram", "whatsapp", "email", "elevenlabs", "custom"];
const statuses: WorkflowRecord["status"][] = ["active", "paused", "draft", "error", "disabled"];
const providerLabels: Record<string, string> = {
  n8n: "Automation Engine",
  "trigger.dev": "Task Runner",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  email: "Email",
  elevenlabs: "Voice",
  custom: "Custom",
};

function familyLabel(value: string) {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function WorkflowRegistryClient({ initialWorkflows, initialRuns, configured }: Props) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [runs] = useState(initialRuns);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState("");

  const counts = useMemo(
    () => ({
      total: workflows.length,
      active: workflows.filter((workflow) => workflow.status === "active").length,
      attention: workflows.filter((workflow) => ["error", "paused"].includes(workflow.status)).length,
    }),
    [workflows],
  );

  const workflowFamilies = useMemo(() => {
    const families = new Map<string, WorkflowRecord[]>();
    workflows.forEach((workflow) => {
      const key = workflow.organization_id || "unassigned";
      families.set(key, [...(families.get(key) || []), workflow]);
    });
    return Array.from(families.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [workflows]);

  async function submitWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const data = new FormData(event.currentTarget);
    const payload = {
      organization_id: String(data.get("organization_id") || "limitless-realty"),
      project_id: String(data.get("project_id") || "limitless-realty"),
      workflow_key: String(data.get("workflow_key") || ""),
      name: String(data.get("name") || ""),
      description: String(data.get("description") || ""),
      provider: String(data.get("provider") || "n8n"),
      external_workflow_id: String(data.get("external_workflow_id") || ""),
      endpoint_url: String(data.get("endpoint_url") || ""),
      status: String(data.get("status") || "draft"),
      timeout_seconds: Number(data.get("timeout_seconds") || 60),
      max_retries: Number(data.get("max_retries") || 2),
    };

    try {
      const response = await fetch("/api/admin/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || "Unable to register workflow.");

      setWorkflows((current) => {
        const others = current.filter((item) => item.id !== result.workflow.id);
        return [result.workflow, ...others];
      });
      event.currentTarget.reset();
      setMessage("Workflow registered successfully.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to register workflow.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(workflow: WorkflowRecord, status: WorkflowRecord["status"]) {
    setWorkingId(workflow.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update workflow.");
      setWorkflows((current) => current.map((item) => item.id === workflow.id ? result.workflow : item));
      setMessage(`${workflow.name} is now ${status}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update workflow.");
    } finally {
      setWorkingId("");
    }
  }

  async function retryRun(run: WorkflowRun) {
    setWorkingId(run.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/workflow-runs/${run.id}/retry`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retry workflow run.");
      setMessage(`${run.workflow_key} retry completed with status ${result.status}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retry workflow run.");
    } finally {
      setWorkingId("");
    }
  }

  function renderWorkflow(workflow: WorkflowRecord) {
    const canActivate = workflow.provider === "n8n"
      ? Boolean(workflow.external_workflow_id)
      : Boolean(workflow.endpoint_url);

    return (
      <div key={workflow.id} className="admin-list-row">
        <div>
          <strong>{workflow.name}</strong>
          <span>{workflow.project_id} · {providerLabels[workflow.provider] || workflow.provider} · v{workflow.current_version}</span>
          <span>{workflow.description || workflow.workflow_key}</span>
        </div>
        <div className="admin-inline-actions">
          <em>{workflow.status}</em>
          {workflow.status === "active" ? (
            <button className="admin-button secondary" type="button" disabled={workingId === workflow.id} onClick={() => changeStatus(workflow, "paused")}>Pause</button>
          ) : (
            <button className="admin-button secondary" type="button" disabled={workingId === workflow.id || !canActivate} onClick={() => changeStatus(workflow, "active")}>Activate</button>
          )}
          <button className="admin-button secondary" type="button" disabled={workingId === workflow.id} onClick={() => changeStatus(workflow, "disabled")}>Disable</button>
        </div>
      </div>
    );
  }

  const failedRuns = runs.filter((run) => ["failed", "timed_out", "cancelled"].includes(run.status)).slice(0, 10);

  return (
    <>
      <section className="admin-stat-grid">
        <article className="admin-stat-card"><span>Registered</span><strong>{counts.total}</strong></article>
        <article className="admin-stat-card"><span>Active</span><strong>{counts.active}</strong></article>
        <article className="admin-stat-card"><span>Needs attention</span><strong>{counts.attention}</strong></article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Register workflow</h2>
          <p>{configured ? "Assign each workflow to its agent family using the organization field." : "Configure Supabase and run the workflow registry migration before saving workflows."}</p>
        </div>

        <form className="admin-form" onSubmit={submitWorkflow}>
          <div className="admin-form-grid">
            <label>Workflow name<input name="name" required placeholder="Maia lead onboarding" /></label>
            <label>Workflow key<input name="workflow_key" required placeholder="maia-lead-onboarding" /></label>
            <label>Agent family / organization<input name="organization_id" defaultValue="limitless-realty" required /></label>
            <label>Project<input name="project_id" defaultValue="limitless-realty" required /></label>
            <label>Provider<select name="provider" defaultValue="n8n">{providers.map((provider) => <option key={provider} value={provider}>{providerLabels[provider] || provider}</option>)}</select></label>
            <label>Status<select name="status" defaultValue="draft">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label>External workflow ID<input name="external_workflow_id" placeholder="Automation engine ID" /></label>
            <label>Endpoint URL<input name="endpoint_url" type="url" placeholder="https://..." /></label>
            <label>Timeout seconds<input name="timeout_seconds" type="number" min="5" defaultValue="60" /></label>
            <label>Maximum retries<input name="max_retries" type="number" min="0" max="10" defaultValue="2" /></label>
          </div>
          <label>Description<textarea name="description" rows={3} placeholder="What this workflow does and which agent uses it." /></label>
          <button className="admin-button" type="submit" disabled={saving || !configured}>{saving ? "Saving..." : "Register workflow"}</button>
          {message ? <p className="admin-form-message">{message}</p> : null}
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Workflow families</h2>
            <p>Workflows are grouped by agent family first, then by operational status.</p>
          </div>
        </div>

        {workflowFamilies.length ? workflowFamilies.map(([family, familyWorkflows]) => (
          <div key={family} style={{ marginTop: 24 }}>
            <div className="admin-panel-header">
              <div>
                <h2>{familyLabel(family)}</h2>
                <p>{familyWorkflows.length} registered workflow{familyWorkflows.length === 1 ? "" : "s"}.</p>
              </div>
            </div>

            {statuses.map((status) => {
              const statusWorkflows = familyWorkflows.filter((workflow) => workflow.status === status);
              if (!statusWorkflows.length) return null;
              return (
                <div key={`${family}-${status}`} className="admin-list" style={{ marginTop: 16 }}>
                  <div className="admin-panel-header">
                    <div>
                      <h2>{familyLabel(status)}</h2>
                      <p>{statusWorkflows.length} workflow{statusWorkflows.length === 1 ? "" : "s"}.</p>
                    </div>
                  </div>
                  {statusWorkflows.map(renderWorkflow)}
                </div>
              );
            })}
          </div>
        )) : <p>No workflows are registered yet.</p>}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Failed runs</h2>
          <p>Retry a failed execution using its original input payload and an incremented attempt number.</p>
        </div>
        <div className="admin-list">
          {failedRuns.length ? failedRuns.map((run) => (
            <div key={run.id} className="admin-list-row">
              <div>
                <strong>{run.workflow_key}</strong>
                <span>{run.status} · attempt {run.attempt} · {run.error_message || "No error message recorded"}</span>
              </div>
              <button className="admin-button secondary" type="button" disabled={workingId === run.id} onClick={() => retryRun(run)}>
                {workingId === run.id ? "Retrying..." : "Retry"}
              </button>
            </div>
          )) : <p>No failed workflow runs need attention.</p>}
        </div>
      </section>
    </>
  );
}
