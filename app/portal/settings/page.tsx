import { Building2, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import { getClientPortalSummary } from "@/lib/client-portal-data";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const session = await getClientSession();
  if (!session) return null;
  const summary = await getClientPortalSummary(session.organizationId);
  const profile = summary.onboarding;

  return (
    <main className="portal-page">
      <header className="portal-section-title"><h1>Settings</h1><p>Workspace identity, escalation details, and security scope.</p></header>
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
        <div className="portal-card-head"><div><h2><ShieldCheck size={17} /> Security</h2><p>Your portal session and all visible data are scoped to your organization.</p></div></div>
        <div className="portal-list">
          <div className="portal-list-row"><div><strong>Organization isolation</strong><span>Records are filtered by your organization identifier.</span></div><em>enabled</em></div>
          <div className="portal-list-row"><div><strong>Role</strong><span>{session.role}</span></div><em>active</em></div>
          <div className="portal-list-row"><div><strong>Membership</strong><span>{session.membershipId}</span></div><em>secured</em></div>
        </div>
      </section>
    </main>
  );
}
