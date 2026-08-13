import Link from "next/link";
import { Activity, Building2, LineChart } from "@/components/admin/ServerIcons";

const organizations = [
  { name: "Limitless Realty", type: "Owned organization", description: "Real estate CRM, Maia, property campaigns, follow-ups and revenue operations.", href: "/dashboard/limitless/leads", icon: Building2 },
  { name: "Gencouv", type: "Owned organization", description: "Trading onboarding, Telegram operations, client acquisition and automation.", href: "/dashboard/gencouv", icon: LineChart },
];

export default function OwnedOrganizationsPage() {
  return <div className="admin-page">
    <div className="admin-page-header"><div><p className="admin-kicker">Admin organizations</p><h1>Owned organization registry</h1><p>Organizations directly owned and operated under Fluxknight administration. Their alerts can appear in the admin command center.</p></div></div>
    <div className="admin-metric-grid">
      <article className="admin-metric-card"><p><Building2 size={15} /> Owned organizations</p><strong>{organizations.length}</strong><span>Admin-operated brands</span></article>
      <article className="admin-metric-card"><p><Activity size={15} /> Notification scope</p><strong>Admin</strong><span>Visible to authorized Fluxknight admins</span></article>
    </div>
    <section className="admin-panel"><div className="admin-panel-header"><div><h2>Organizations</h2><p>Open an organization to manage its specific agents, workflows, CRM and notifications.</p></div></div><div className="admin-list">
      {organizations.map((organization) => <Link href={organization.href} key={organization.name} className="admin-list-row"><div style={{ display: "flex", gap: 12, alignItems: "center" }}><organization.icon size={18} /><div><strong>{organization.name}</strong><span>{organization.description}</span></div></div><em>{organization.type}</em></Link>)}
    </div></section>
  </div>;
}
