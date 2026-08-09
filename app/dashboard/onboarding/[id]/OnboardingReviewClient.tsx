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
type Template = { id: string; name: string; slug: string; industry: string; description?: string | null; status: string };
type Event = { id: string; from_status?: string | null; to_status: string; reason?: string | null; changed_by?: string | null; created_at: string };
type Document = { id: string; file_name: string; document_type: string; status: string; storage_bucket: string; storage_path: string; created_at: string };

const statusOptions = ["under_review", "provisioning", "internal_testing", "live", "maintenance", "suspended"];

function pretty(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function DetailSection({ title, data }: { title: string; data?: Json }) {
  const entries = Object.entries(data || {});
  return (
    <details className="admin-panel">
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>{title}</summary>
      <div className="admin-list" style={{ marginTop: 16 }}>
        {entries.map(([key, value]) => (
          <div className="admin-list-row" key={key}>
            <div><strong>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</strong><span style={{ whiteSpace: "pre-wrap" }}>{pretty(value)}</span></div>
          </div>
        ))}
        {!entries.length ? <p>No information supplied.</p> : null}
      </div>
    </details>
  );
}

export default function OnboardingReviewClient({ submission, documents, initialNotes, initialTasks, events, organizations, models, templates }: {
  submission: Submission;
  documents: Document[];
  initialNotes: Note[];
  initialTasks: Task[];
  events: Event[];
  organizations: Organization[];
  models: Model[];
  templates: Template[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [nextStatus, setNextStatus] = useState(statusOptions.includes(submission.status) ? submission.status : "under_review");

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

  async function provisionOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("provision");
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await adminAction({
        action: "provision_organization",
        onboardingId: submission.id,
        templateSlug: data.get("templateSlug"),
        modelId: data.get("modelId") || "",
      });
      setMessage(`${result.organization?.organization_name || "Organization"} was created and provisioned successfully.`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to provision organization.");
    } finally {
      setBusy("");
    }
  }

  async function changeStatus() {
    setBusy("status");
    setMessage("");
    try {
      await adminAction({ action: "update_status", onboardingId: submission.id, status: nextStatus });
      setMessage(`Onboarding status changed to ${nextStatus.replaceAll("_", " ")}.`);
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
    if (!submission.organization_id) return setMessage("Link or provision an organization before assigning an AI model.");
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

      <details className="admin-panel" open={!submission.organization_id}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Workspace setup</summary>
        <div style={{ marginTop: 18 }}>
          {!submission.organization_id ? (
            <>
              <div className="admin-panel-header"><div><h2>Create client workspace</h2><p>Create the organization, apply the approved template, enable package modules, and optionally assign its AI model.</p></div></div>
              <form className="admin-form" onSubmit={provisionOrganization}>
                <div className="admin-form-grid">
                  <label>Organization template<select name="templateSlug" required defaultValue=""><option value="" disabled>Select template</option>{templates.map((template) => <option key={template.id} value={template.slug}>{template.name} · {template.industry}</option>)}</select></label>
                  <label>Approved AI model<select name="modelId" defaultValue=""><option value="">Assign later</option>{models.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.display_name}</option>)}</select></label>
                </div>
                <button className="admin-button" disabled={busy === "provision"} type="submit">{busy === "provision" ? "Provisioning..." : "Create workspace"}</button>
              </form>

              <details style={{ marginTop: 18 }}>
                <summary style={{ cursor: "pointer", color: "var(--admin-text-soft)" }}>Link an existing organization instead</summary>
                <form className="admin-form" onSubmit={linkOrganization} style={{ marginTop: 14 }}>
                  <label>Existing organization<select name="organizationId" required defaultValue=""><option value="" disabled>Select organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name} · {org.status}</option>)}</select></label>
                  <button className="admin-button secondary" disabled={busy === "organization"} type="submit">{busy === "organization" ? "Saving..." : "Link organization"}</button>
                </form>
              </details>
            </>
          ) : (
            <>
              <div className="admin-list-row"><div><strong>{submission.organizations?.name || "Client workspace"}</strong><span>{submission.organizations?.status || "Organization linked"}</span></div></div>
              <form className="admin-form" onSubmit={assignModel} style={{ marginTop: 16 }}>
                <label>Approved AI model<select name="modelId" required defaultValue=""><option value="" disabled>Select model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.provider} · {model.display_name}</option>)}</select></label>
                <button className="admin-button secondary" disabled={busy === "model"} type="submit">{busy === "model" ? "Assigning..." : "Assign model"}</button>
              </form>
            </>
          )}
        </div>
      </details>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Onboarding stage</h2><p>Use one controlled status action instead of several competing buttons.</p></div></div>
        <div className="admin-form-grid">
          <label>Status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
        </div>
        <button className="admin-button" disabled={busy === "status" || nextStatus === submission.status} onClick={changeStatus} type="button">{busy === "status" ? "Updating..." : "Update status"}</button>
      </section>

      <details className="admin-panel" open>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Client intake</summary>
        <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
          <DetailSection title="Business information" data={submission.business_information} />
          <DetailSection title="Products and services" data={submission.business_services} />
          <DetailSection title="Contact and communication" data={submission.communication_details} />
          <DetailSection title="AI requirements" data={submission.automation_requirements} />
          <DetailSection title="Business knowledge and resources" data={submission.business_resources} />
        </div>
      </details>

      <details className="admin-panel">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Uploaded documents ({documents.length})</summary>
        <div className="admin-list" style={{ marginTop: 16 }}>{documents.map((document) => <div className="admin-list-row" key={document.id}><div><strong>{document.file_name}</strong><span>{document.document_type} · {document.status}</span><span>{document.storage_bucket}/{document.storage_path}</span></div></div>)}{!documents.length ? <p>No uploaded documents.</p> : null}</div>
      </details>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Deployment checklist</h2><p>Everything required before activation stays attached to this client record.</p></div></div>
        <div className="admin-list">{tasks.map((task) => <div className="admin-list-row" key={task.id}><div><strong>{task.title}</strong><span>{task.task_key}</span></div><div className="admin-inline-actions"><em className={task.status === "completed" ? "good" : task.status === "blocked" ? "bad" : "muted"}>{task.status.replaceAll("_", " ")}</em><select disabled={busy === task.id} value={task.status} onChange={(event) => updateTask(task, event.target.value)}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="skipped">Skipped</option></select></div></div>)}</div>
      </section>

      <details className="admin-panel">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Internal notes ({notes.length})</summary>
        <div style={{ marginTop: 16 }}>
          <form className="admin-form" onSubmit={addNote}><label>Note<textarea required name="note" rows={3} /></label><label>Visibility<select name="visibility" defaultValue="internal"><option value="internal">Internal only</option><option value="client">Client visible</option></select></label><button className="admin-button" disabled={busy === "note"} type="submit">Add note</button></form>
          <div className="admin-list">{notes.map((note) => <div className="admin-list-row" key={note.id}><div><strong>{note.visibility} note</strong><span>{note.note}</span><span>{note.author_email || "Platform admin"} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.created_at))}</span></div></div>)}</div>
        </div>
      </details>

      <details className="admin-panel">
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Status history ({events.length})</summary>
        <div className="admin-list" style={{ marginTop: 16 }}>{events.map((event) => <div className="admin-list-row" key={event.id}><div><strong>{event.from_status || "created"} → {event.to_status}</strong><span>{event.reason || "No reason supplied"}</span><span>{event.changed_by || "system"} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</span></div></div>)}</div>
      </details>
    </>
  );
}
