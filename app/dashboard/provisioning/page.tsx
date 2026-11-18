import Link from "next/link";
import { PageHeader, DashboardCard, CardHeader, StatusBadge, Button, EmptyState } from "@/components/ui/DashboardPrimitives";
import { getAdminOrganizations } from "@/lib/admin-control-center";
import { getAdminProvisioningDetail } from "@/lib/admin-provisioning-detail";
import { isOrganizationId } from "@/lib/organization-context-catalog";
import { tenantStageLabels } from "@/lib/tenant-readiness";
import styles from "@/components/admin/ControlCenter.module.css";
export const dynamic = "force-dynamic";

export default async function ProvisioningPage({ searchParams }: { searchParams: Promise<{ organizationId?: string }> }) {
  const { organizationId } = await searchParams;
  const organizations = await getAdminOrganizations().catch(() => null);
  let failure = organizationId && !isOrganizationId(organizationId) ? "Choose a valid organization." : "";
  const detail = organizationId && isOrganizationId(organizationId) ? await getAdminProvisioningDetail(organizationId).catch(() => { failure = "Readiness evidence unavailable. Refresh to retry."; return null; }) : null;
  if (organizationId && !detail && !failure) failure = "Organization not found. No provisioning action was performed.";
  return <main className="admin-page dashboard-v2-page"><div className={styles.stack}>
    <PageHeader kicker="Onboarding & provisioning" title="Provisioning Control Center" description="Review the existing Tenant Readiness Engine before recovery, testing or activation. Completed jobs alone do not establish tenant readiness." actions={<Button href="/dashboard/onboarding#new-client">Onboard organization</Button>} />
    <DashboardCard><CardHeader title="Choose an organization" description="Latest 100 organizations. Open a readiness link from the full management registry for records outside this sample." />
      <form action="/dashboard/provisioning" method="get" className={styles.actions}>
        <label className={styles.identity}><span>Organization</span><select className="admin-input" name="organizationId" defaultValue={organizationId || ""} required><option value="" disabled>Select organization</option>{(organizations?.rows || []).map(row => <option value={row.id} key={row.id}>{row.name} · {row.slug}</option>)}{detail && !organizations?.rows.some(row => row.id === detail.organization.id) ? <option value={detail.organization.id}>{detail.organization.name}</option> : null}</select></label>
        <Button type="submit" disabled={!organizations?.available && !detail}>Review readiness</Button>
      </form>
      {!organizations?.available ? <p role="alert">Organization selector unavailable. Refresh to retry.</p> : null}
      {organizations?.truncated ? <p className={styles.note}>Older organizations are outside this sample. Use a direct organization readiness link.</p> : null}
      {failure ? <p role="alert">{failure}</p> : null}
      {!organizationId ? <EmptyState title="Select a workspace to review its evidence" description="Readiness is evaluated for one organization at a time. This view does not provision or activate services." /> : null}
    </DashboardCard>
    {detail ? <>
      <DashboardCard><CardHeader title={detail.organization.name} description={`Organization ${detail.organization.id}`} actions={<Button href={`/dashboard/clients/${detail.organization.id}/setup`}>Open setup & recovery</Button>} />
        <div className={styles.status}><StatusBadge tone={detail.readiness.stage === "needs_attention" ? "error" : detail.readiness.stage === "active" ? "success" : "info"}>{tenantStageLabels[detail.readiness.stage]}</StatusBadge><span>Lifecycle: {detail.organization.status}</span></div>
        <p className={styles.note}>Review and retry saved provisioning steps in existing setup controls. Retries retain existing identities. Testing and activation still require the existing approval process.</p>
        <ul className={styles.evidence}>{detail.readiness.checks.map(check => <li key={check.key}><div className={styles.status}><StatusBadge tone={check.ready ? "success" : "warning"}>{check.ready ? "Ready" : "Blocked"}</StatusBadge><strong>{check.label}</strong></div>{!check.ready ? <><span>{check.action}</span><Link href={check.href}>Review required action</Link></> : null}</li>)}</ul>
      </DashboardCard>
      <div className={styles.grid}>
        <DashboardCard><CardHeader title="Ownership & membership" description="Active roles are shown independently of platform administrator privileges." actions={<Button variant="outline" href={`/dashboard/clients/${detail.organization.id}/manage`}>Manage team & access</Button>} />
          {detail.members === null ? <p role="alert">Membership evidence unavailable.</p> : <ul className={styles.evidence}>{detail.members.map(member => <li key={member.id}><strong>User {member.user_id}</strong><span>{member.status} · {(member.membership_roles as unknown as Array<{ roles: { slug: string } | null }> || []).map(binding => binding.roles?.slug).filter(Boolean).join(", ") || "No assigned role"}</span></li>)}{!detail.members.length ? <li>No memberships recorded. Assign an active owner before activation.</li> : null}</ul>}
          {detail.membersTruncated ? <p className={styles.note}>Latest 100 memberships shown. Review full access in organization management.</p> : null}
        </DashboardCard>
        <DashboardCard><CardHeader title="Subscription & industry template" description="Subscription and template records remain separate from lifecycle and readiness." actions={<Button variant="outline" href={`/dashboard/clients/${detail.organization.id}/manage`}>Review package & template</Button>} />
          {detail.subscription === undefined ? <p role="alert">Subscription evidence unavailable.</p> : <p>{detail.subscription ? `Subscription: ${detail.subscription.status}. ${detail.subscription.status === "trialing" ? `Trial ends: ${detail.subscription.trial_ends_at || "Not recorded"}` : `Period ends: ${detail.subscription.current_period_end || "Not recorded"}`}` : "No subscription recorded."}</p>}
          {detail.templates === null ? <p role="alert">Industry template assignments unavailable.</p> : <ul className={styles.evidence}>{detail.templates.map(template => { const item = template.organization_templates as unknown as { name?: string; industry?: string } | null; return <li key={template.id}><strong>{item?.name || "Assigned template"}</strong><span>{item?.industry || "Industry not recorded"} · {template.status}</span></li>; })}{!detail.templates.length ? <li>No organization template assignment recorded. Review agent-family template evidence in setup.</li> : null}</ul>}
          {detail.templatesTruncated ? <p className={styles.note}>Latest 20 assignments shown.</p> : null}
        </DashboardCard>
      </div>
      <DashboardCard><CardHeader title="Deployment jobs" description="Latest 20 jobs for this organization. A completed job is not activation approval." />
        {detail.jobs === null ? <p role="alert">Deployment jobs unavailable.</p> : <ul className={styles.evidence}>{detail.jobs.map(job => <li key={job.id}><strong>{job.status.replaceAll("_", " ")} · attempt {job.attempts}/{job.max_attempts}</strong><span>Job {job.id} · {new Date(job.updated_at).toLocaleString("en-GB")}</span></li>)}{!detail.jobs.length ? <li>No deployment jobs recorded. Review workflow evidence and saved starter provisioning in setup.</li> : null}</ul>}
        {detail.jobsTruncated ? <p className={styles.note}>Older jobs are outside this sample.</p> : null}
      </DashboardCard>
    </> : null}
  </div></main>;
}
