"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { AutomationTemplate, AutomationTemplateVersion } from "@/lib/automation-provisioning";

type JobRow = {
  id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
};

export default function AutomationTemplateManager({
  templates,
  versions,
  jobs,
}: {
  templates: AutomationTemplate[];
  versions: AutomationTemplateVersion[];
  jobs: JobRow[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries());

    try {
      const response = await fetch("/api/admin/automation-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save automation template.");
      event.currentTarget.reset();
      setMessage("Automation template saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save automation template.");
    } finally {
      setWorking(false);
    }
  }

  async function retry(jobId: string) {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/automation-provisioning-jobs/${jobId}/retry`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to retry job.");
      setMessage("Provisioning job requeued.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to retry job.");
    } finally {
      setWorking(false);
    }
  }

  async function runProvisioningNow() {
    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/automation-provisioning/run", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to run provisioning.");
      const processed = Number(result.processed || 0);
      setMessage(processed ? `Provisioning ran ${processed} job${processed === 1 ? "" : "s"}.` : "No queued provisioning jobs were waiting.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to run provisioning.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Template library</h2>
            <p>Register sellable automations and approved n8n source templates for tenant cloning.</p>
          </div>
          <span className="admin-status live">{templates.filter((item) => item.status === "available").length} available</span>
        </div>

        <form className="admin-form" onSubmit={submit}>
          <div className="admin-form-grid">
            <label>Name<input name="name" required placeholder="WhatsApp Lead Follow-up" /></label>
            <label>Slug<input name="slug" required placeholder="whatsapp-lead-follow-up" /></label>
            <label>Category<input name="category" defaultValue="lead follow-up" /></label>
            <label>Channels<input name="channels" placeholder="whatsapp,email" /></label>
            <label>Required plan<input name="required_plan" placeholder="Growth" /></label>
            <label>Setup price<input name="setup_price" type="number" min="0" defaultValue="0" /></label>
            <label>Recurring price<input name="recurring_price" type="number" min="0" defaultValue="0" /></label>
            <label>Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="available">Available</option></select></label>
            <label>Version<input name="version" type="number" min="1" defaultValue="1" /></label>
            <label>Source n8n template ID<input name="source_n8n_workflow_id" placeholder="n8n workflow ID" /></label>
            <label>Version status<select name="version_status" defaultValue="draft"><option value="draft">Draft</option><option value="approved">Approved</option></select></label>
          </div>
          <label>Description<textarea name="description" rows={3} placeholder="Business-facing description shown in the client library." /></label>
          <label>Validation notes<textarea name="validation_notes" rows={2} placeholder="Admin notes about template readiness." /></label>
          <button className="admin-button" type="submit" disabled={working}>{working ? "Saving..." : "Save automation template"}</button>
          {message ? <p className="admin-form-message">{message}</p> : null}
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Approved clone sources</h2><p>Only approved versions are eligible for paid client provisioning.</p></div></div>
        <div className="admin-list">
          {versions.map((version) => {
            const template = templates.find((item) => item.id === version.automation_template_id);
            return (
              <div className="admin-list-row" key={version.id}>
                <div>
                  <strong>{template?.name || "Automation template"} v{version.version}</strong>
                  <span>{version.status} &middot; {version.source_n8n_workflow_name || "n8n source template"}</span>
                </div>
                <em>{template?.status || "draft"}</em>
              </div>
            );
          })}
          {!versions.length ? <p className="admin-empty">No automation template versions have been registered yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Provisioning jobs</h2>
            <p>Retry-safe clone jobs with redacted error recording.</p>
          </div>
          <button className="admin-button secondary" type="button" disabled={working} onClick={runProvisioningNow}>
            {working ? "Running..." : "Run provisioning now"}
          </button>
        </div>
        <div className="admin-list">
          {jobs.map((job) => (
            <div className="admin-list-row" key={job.id}>
              <div>
                <strong>{job.status}</strong>
                <span>attempt {job.attempts}/{job.max_attempts} &middot; {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.created_at))}</span>
                {job.last_error ? <span>{job.last_error}</span> : null}
              </div>
              {["failed", "queued"].includes(job.status) ? <button className="admin-button secondary" type="button" disabled={working} onClick={() => retry(job.id)}>Retry</button> : <em>{job.status}</em>}
            </div>
          ))}
          {!jobs.length ? <p className="admin-empty">No clone provisioning jobs have run yet.</p> : null}
        </div>
      </section>
    </>
  );
}
