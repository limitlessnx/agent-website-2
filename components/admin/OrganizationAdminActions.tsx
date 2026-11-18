"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, InputField, TextareaField } from "@/components/ui/DashboardPrimitives";
import { Dialog } from "@/components/ui/DashboardInteractions";
import SubscriptionControl from "@/app/dashboard/scale/SubscriptionControl";
import { organizationCategory } from "@/lib/organization-context-catalog";
import styles from "./ControlCenter.module.css";

type Organization = { id: string; name: string; slug: string; status: string };
type Options = { plans: Array<{ id: string; name: string }>; subscription?: { plan_id: string; status: string } | null; organizationStatus: string };

export default function OrganizationAdminActions({ organization }: { organization: Organization }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState<"upgrade" | "delete" | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const archived = organization.status === "archived";
  const protectedOrganization = organizationCategory(organization.slug) !== "customer";

  async function loadPlans() {
    setLoading(true); setError(""); setOptions(null);
    try {
      const response = await fetch(`/api/admin/subscriptions?organizationId=${encodeURIComponent(organization.id)}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(result?.plans)) throw new Error(result?.error || "Unable to load plan options.");
      setOptions(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection unavailable. Try again."); }
    finally { setLoading(false); }
  }
  async function archive() {
    if (busy || confirmation !== organization.name || !reason.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/organizations/${encodeURIComponent(organization.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmation, reason }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.archived) throw new Error(result?.error || "Archiving was not confirmed. Refresh before retrying.");
      setNotice(result.auditWarning ? "Organization archived; final audit outcome needs review. Customer records are retained." : "Organization archived. Customer records are retained; review external billing and running work separately.");
      setOpen(null); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection unavailable. Refresh before retrying."); }
    finally { setBusy(false); }
  }
  return <div className={styles.stack}>
    <div className={styles.actions}>
      <Button variant="outline" disabled={archived} onClick={() => { setOpen("upgrade"); setNotice(""); void loadPlans(); }}>Manual upgrade</Button>
      <button type="button" className={`admin-button ${styles.destructive}`} disabled={archived || protectedOrganization} title={protectedOrganization ? "Platform and internal system organizations are protected" : archived ? "Organization is already archived" : undefined} onClick={() => { setOpen("delete"); setError(""); setNotice(""); setConfirmation(""); setReason(""); }}>Delete organization</button>
    </div>
    {notice ? <p role="status" className={styles.note}>{notice}</p> : null}
    <Dialog open={open === "upgrade"} onClose={() => { if (!busy) setOpen(null); }} title="Manual organization upgrade">
      <div className={styles.stack}><strong>{organization.name}</strong><p className={styles.note}>Assign an existing billing plan and its credits manually. No payment is collected, and any external provider subscription is not cancelled. Reconcile provider billing separately.</p>
        {loading ? <p role="status">Loading active plans…</p> : null}
        {error ? <div><p role="alert">{error}</p><Button variant="outline" onClick={() => void loadPlans()}>Retry plan options</Button></div> : null}
        {options ? options.organizationStatus === "archived" ? <p role="alert">Archived organizations cannot be upgraded.</p> : options.plans.length ? <SubscriptionControl key={options.subscription?.plan_id || "new"} organizations={[{ id: organization.id, name: organization.name }]} plans={options.plans} initialPlanId={options.subscription?.plan_id || ""} requireConfirmation onSavingChange={setBusy} /> : <p>No active billing plans are available.</p> : null}
      </div>
    </Dialog>
    <Dialog open={open === "delete"} onClose={() => { if (!busy) setOpen(null); }} title="Delete organization (archive)">
      <div className={styles.stack}><strong>{organization.name}</strong><p className={styles.note}>This archives the organization and retains its customer records, memberships and history. Existing guarded tenant work will be suppressed. External billing, integrations and already-running provider operations are not automatically cancelled.</p>
        <InputField id={`${id}-confirmation`} label="Type the exact organization name" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
        <TextareaField id={`${id}-reason`} label="Reason for archiving" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} />
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.actions}><Button variant="outline" onClick={() => setOpen(null)} disabled={busy}>Cancel</Button><Button onClick={() => void archive()} disabled={busy || confirmation !== organization.name || !reason.trim()} loading={busy} action="deleting">Confirm archive</Button></div>
      </div>
    </Dialog>
  </div>;
}
