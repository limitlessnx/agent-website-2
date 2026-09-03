import { Building2, Mail, Phone, ShieldCheck, User, Users } from "@/components/admin/ServerIcons";
import AccountAdministrationPanel from "@/components/portal/AccountAdministrationPanel";
import { getAccountAdministrationSnapshot } from "@/lib/account-administration";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary } from "@/lib/client-portal-data";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const [summary, account] = await Promise.all([
    getClientPortalSummary(session.organizationId),
    getAccountAdministrationSnapshot(session.organizationId),
  ]);
  const profile = summary.onboarding;

  return (
    <main className="portal-page">
      <header className="portal-section-title"><h1>Settings</h1><p>Workspace identity, members, ownership, account state, and security scope.</p></header>
      <section className="portal-grid">
        <article className="portal-card">
          <div className="portal-card-head"><div><h2><Building2 size={17} /> Business profile</h2><p>Captured during onboarding.</p></div></div>
          <div className="portal-form-grid">
            <div className="portal-field"><label>Business name</label><input readOnly value={profile?.business_name || ""} /></div>
            <div className="portal-field"><label>Industry</label><input readOnly value={profile?.industry || ""} /></div>
            <div className="portal-field"><label>Business email</label><input readOnly value={profile?.business_email || session.email} /></div>
            <div className="portal-field"><label>Phone</label><input readOnly value={profile?.phone || ""} /></div>
            <div className="portal-field"><label>Country</label><input readOnly value={profile?.country || ""} /></div>
            <div className="portal-field"><label>Time zone</label><input readOnly value={profile?.timezone || ""} /></div>
          </div>
        </article>
        <article className="portal-card">
          <div className="portal-card-head"><div><h2><User size={17} /> Human handoff</h2><p>The person agents escalate sensitive or high-intent cases to.</p></div></div>
          <div className="portal-list">
            <div className="portal-list-row"><div><strong><User size={14} /> Contact</strong><span>{profile?.human_contact_name || "Not provided"}</span></div></div>
            <div className="portal-list-row"><div><strong><Mail size={14} /> Email</strong><span>{profile?.human_contact_email || "Not provided"}</span></div></div>
            <div className="portal-list-row"><div><strong><Phone size={14} /> Business phone</strong><span>{profile?.phone || "Not provided"}</span></div></div>
          </div>
        </article>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2><Users size={17} /> Workspace members</h2><p>Membership and ownership visibility for this organization.</p></div></div>
        <div className="portal-list">
          {account?.members.map((member) => (
            <div className="portal-list-row" key={member.id}>
              <div><strong>{member.role === "owner" ? "Workspace owner" : member.role}</strong><span>User {member.user_id.slice(0, 8)}… · joined {new Date(member.created_at).toLocaleDateString()}</span></div>
              <em>{member.status}</em>
            </div>
          ))}
          {!account?.members.length ? <div className="portal-list-row"><div><strong>No memberships found</strong><span>Contact Fluxknight support if this persists.</span></div><em>attention</em></div> : null}
        </div>
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2><Building2 size={17} /> Account administration</h2><p>Owner-gated lifecycle controls. Billing-plan changes remain deferred while the payment model is being revised.</p></div><em>{account?.organization.status || "unknown"}</em></div>
        {account ? (
          <AccountAdministrationPanel
            status={account.organization.status}
            cancellationRequestedAt={account.lifecycle.cancellation_requested_at}
            cancellationReason={account.lifecycle.cancellation_reason}
            ownershipTransferTargetEmail={account.lifecycle.ownership_transfer_target_email}
            isOwner={session.role === "owner"}
          />
        ) : <div className="portal-list-row"><div><strong>Account state unavailable</strong><span>Organization lifecycle data could not be loaded.</span></div><em>attention</em></div>}
      </section>

      <section className="portal-card">
        <div className="portal-card-head"><div><h2><ShieldCheck size={17} /> Security</h2><p>Your portal session and all visible data are scoped to your organization.</p></div></div>
        <div className="portal-list">
          <div className="portal-list-row"><div><strong>Organization isolation</strong><span>Records are filtered by your organization identifier.</span></div><em>enabled</em></div>
          <div className="portal-list-row"><div><strong>Role</strong><span>{session.role}</span></div><em>active</em></div>
          <div className="portal-list-row"><div><strong>Membership</strong><span>{session.membershipId}</span></div><em>secured</em></div>
          <div className="portal-list-row"><div><strong>Account changes</strong><span>Lifecycle mutations require owner role, explicit confirmation, and write an audit log.</span></div><em>audited</em></div>
        </div>
      </section>
    </main>
  );
}
