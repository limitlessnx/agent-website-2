import { redirect } from "next/navigation";
import { Building2, ShieldCheck, Users } from "lucide-react";
import { getClientSession } from "@/lib/client-auth";
import ClientLogoutButton from "./ClientLogoutButton";

export const metadata = { title: "Client Portal | Fluxknight" };

export default async function ClientPortalPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");

  return (
    <main className="admin-page" style={{ maxWidth: 960, margin: "0 auto", padding: "48px 20px" }}>
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Client workspace</p>
          <h1>{session.organizationSlug}</h1>
          <p>Signed in as {session.email}</p>
        </div>
        <ClientLogoutButton />
      </div>

      <section className="admin-stat-grid">
        <article className="admin-stat-card"><span><Building2 size={16} /> Organization</span><strong>Active</strong></article>
        <article className="admin-stat-card"><span><Users size={16} /> Membership</span><strong>{session.role}</strong></article>
        <article className="admin-stat-card"><span><ShieldCheck size={16} /> Access</span><strong>Tenant scoped</strong></article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Workspace created</h2>
            <p>Your organization and owner membership are connected. Business modules will be enabled according to your plan and installed agent family.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
