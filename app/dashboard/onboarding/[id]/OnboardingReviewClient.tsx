"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Json = Record<string, unknown>;
type Submission = {
  id: string;
  purchaser_email: string;
  payment_status: string;
  payment_provider?: string | null;
  payment_reference?: string | null;
  status: string;
  organization_id?: string | null;
  business_information?: Json;
  business_services?: Json;
  communication_details?: Json;
  automation_requirements?: Json;
  business_resources?: Json;
  review_confirmation?: Json;
  service_packages?: { name: string; currency: string; billing_interval: string; included_modules?: unknown[] } | null;
  organizations?: { id: string; name: string; slug: string; status: string } | null;
};
type Task = { id: string; title: string; task_key: string; status: string; completed_at?: string | null };
type Note = { id: string; note: string; visibility: string; author_email?: string | null; created_at: string };
type Organization = { id: string; name: string; slug: string; status: string };
type Model = { id: string; provider: string; model_key: string; display_name: string; status: string };
type Event = { id: string; from_status?: string | null; to_status: string; reason?: string | null; changed_by?: string | null; created_at: string };
type Document = { id: string; file_name: string; document_type: string; status: string; storage_bucket: string; storage_path: string; created_at: string };

function pretty(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function DetailSection({ title, data }: { title: string; data?: Json }) {
  const entries = Object.entries(data || {});
  return (
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>{title}</h2><p>Information supplied by the client.</p></div></div>
      <div className="admin-list">
        {entries.map(([key, value]) => (
          <div className="admin-list-row" key={key}>
            <div><strong>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</strong><span style={{ whiteSpace: "pre-wrap" }}>{pretty(value)}</span></div>
          </div>
        ))}
        {!entries.length ? <p>No information supplied.</p> : null}
      </div>
    </section>
  );
}

export default function OnboardingReviewClient({ submission, documents, initialNotes, initialTasks, events, organizations, models }: {
  submission: Submission;
  documents: Document[];
  initialNotes: Note[];
  initialTasks: Task[];
  events: Event[];
  organizations: Organization[];
  models: Model[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const completed = useMemo(() => tasks.filter((task) => task.status === "completed").length, [tasks]);

  async function adminAction(payload: Record<string, unknown>) {
    const response = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to update onboarding.");
    return result;
  }

  async function changeStatus(status: string) {
    setBusy(`status-${status}`);
    setMessage("");
    try {
      await adminAction({ action: "update_status", onboardingId: submission.id, status });
      setMessage(`Onboarding status changed to ${status.replaceAll("_", " ")}.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change status.");
    } finally { setBusy(""); }
  }

  async function updateTask(task: Task, status: string) {
    setBusy(task.id);
    setMessage("");
    try {
      await adminAction({ action: "update_task", taskId: task.id, status });
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update task.");
    } finally { setBusy(""); }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("note");
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const result = await adminAction({ action: "add_note", onboardingId: submission.id, note: data.get("note"), visibility: data.get("visibility") });
      const created = Array.isArray(result.result) ? result.result[0] : null;
      if (created) setNotes((current) => [created, ...current]);
      form.reset();
      setMessage("Note added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add note.");
    } finally { setBusy(""); }
  }

  async function linkOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("organization");
    const data = new FormData(event.currentTarget);
    try {
      await adminAction({ action: "link_organization", onboardingId: submission.id, organizationId: data.get("organizationId") });
      setMessage("Organization linked to this onboarding record.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to link organization.");
    } finally { setBusy(""); }
  }

  async function assignModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!submission.organization_id) return setMessage("Link an organization before assigning an AI model.");
    setBusy("model");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_model", organizationId: submission.organization_id, modelId: data.get("modelId") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to assign model.");
      setMessage("Approved AI model assigned to the organization.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to assign model.");
    } finally { setBusy(""); }
  }

  return (
    <>
      <section className="admin-stat-grid">
        <article className="admin-stat-card"><span>Package</span><strong>{submission.service_packages?.name || "Unassigned"}</strong></article>
        <article className="admin-stat-card"><span>Payment</span><strong>{submission.payment_status}</strong></article>
        <article className="admin-stat-card"><span>Delivery status</span><strong>{submission.status.replaceAll("_", " ")}</strong></article>
        <article className="admin-stat-card"><span>Checklist</span><strong>{completed}/{tasks.length}</strong></article>
      </section>

      {message ? <section className="admin-panel"><p className="admin-form-message">{message}</p></section> : null}

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Delivery controls</h2><p>Only the Super Admin assigns the workspace, model, systems, and final activation state.</p></div></div>
        <div className="admin-form-grid">
          <form className="admin-form" onSubmit={linkOrganization}>
            <label>Organization<select name="organizationId" required defaultValue={submission.organization_id || ""}><option value="" disabled>Select organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.status}</option>)}</select></label>
            <button className="admin-button" disabled={busy === "organization"} type="submit">{busy === "organization" ? "Saving..." : "Link organization"}</button>
          </form>
          <form className="admin-form" onSubmit={assignModel}>
            <label>Approved AI model<select name="modelId" required defaultValue=""><option value="" disabled>Select model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.display_name}</option>)}</select></label>
            <button className="admin-button" disabled={busy === "model" || !submission.organization_id} type="submit">{busy === "model" ? "Assigning..." : "Assign model"}</button>
          </form>
        </div>
        <div className="admin-inline-actions" style={{ marginTop: 18, flexWrap: "wrap" }}>
          {["under_review", "provisioning", "internal_testing", "live", "maintenance", "suspended"].map((status) => <button key={status} className="admin-button secondary" disabled={busy === `status-${status}`} onClick={() => changeStatus(status)} type="button">{status.replaceAll("_", " ")}</button>)}
        </div>
      </section>

      <DetailSection title="Business information" data={submission.business_information} />
      <DetailSection title="Business and services" data={submission.business_services} />
      <DetailSection title="Contact and communication" data={submission.communication_details} />
      <DetailSection title="Automation requirements" data={submission.automation_requirements} />
      <DetailSection title="Business resources" data={submission.business_resources} />

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Uploaded documents</h2><p>File references supplied during onboarding.</p></div></div>
        <div className="admin-list">{documents.map((document) => <div className="admin-list-row" key={document.id}><div><strong>{document.file_name}</strong><span>{document.document_type} · {document.status}</span><span>{document.storage_bucket}/{document.storage_path}</span></div></div>)}{!documents.length ? <p>No uploaded documents.</p> : null}</div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Deployment checklist</h2><p>Complete each task before turning the workspace loose on an unsuspecting business.</p></div></div>
        <div className="admin-list">{tasks.map((task) => <div className="admin-list-row" key={task.id}><div><strong>{task.title}</strong><span>{task.task_key}</span></div><div className="admin-inline-actions"><em className={task.status === "completed" ? "good" : task.status === "blocked" ? "bad" : "muted"}>{task.status.replaceAll("_", " ")}</em><select disabled={busy === task.id} value={task.status} onChange={(event) => updateTask(task, event.target.value)}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="skipped">Skipped</option></select></div></div>)}</div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Internal notes</h2><p>Keep configuration decisions and client-facing updates attached to the delivery record.</p></div></div>
        <form className="admin-form" onSubmit={addNote}><label>Note<textarea required name="note" rows={3} /></label><label>Visibility<select name="visibility" defaultValue="internal"><option value="internal">Internal only</option><option value="client">Client visible</option></select></label><button className="admin-button" disabled={busy === "note"} type="submit">Add note</button></form>
        <div className="admin-list">{notes.map((note) => <div className="admin-list-row" key={note.id}><div><strong>{note.visibility} note</strong><span>{note.note}</span><span>{note.author_email || "Platform admin"} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at))}</span></div></div>)}</div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Status history</h2><p>Audit trail for delivery-stage changes.</p></div></div>
        <div className="admin-list">{events.map((event) => <div className="admin-list-row" key={event.id}><div><strong>{event.from_status || "created"} → {event.to_status}</strong><span>{event.reason || "No reason supplied"}</span><span>{event.changed_by || "system"} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</span></div></div>)}</div>
      </section>
    </>
  );
}
