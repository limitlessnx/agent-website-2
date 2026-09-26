import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics | Fluxknight" };

async function count(path:string) {
  const rows = await supabaseServerRequest<Array<{id:string}>>(path).catch(() => []);
  return rows.length;
}

export default async function AnalyticsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["analytics.view"]); } catch { redirect("/portal"); }
  const org = encodeURIComponent(session.organizationId);
  const [customers,leads,conversations,systems] = await Promise.all([
    count(`crm_customers?organization_id=eq.${org}&select=id&limit=1000`),
    count(`crm_leads?organization_id=eq.${org}&select=id&limit=1000`),
    count(`crm_conversations?organization_id=eq.${org}&select=id&limit=1000`),
    count(`organization_systems?organization_id=eq.${org}&status=eq.active&select=id&limit=1000`),
  ]);
  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">Analytics</p><h1>Workspace performance</h1><p>Current tenant-scoped operating counts. Deeper system analytics will build on this surface.</p></div></section>
    <section className="portal-business-metrics">
      <article className="portal-business-metric"><span>Customers</span><strong>{customers}</strong></article>
      <article className="portal-business-metric"><span>Leads</span><strong>{leads}</strong></article>
      <article className="portal-business-metric"><span>Conversations</span><strong>{conversations}</strong></article>
      <article className="portal-business-metric"><span>Active systems</span><strong>{systems}</strong></article>
    </section>
  </main>;
}
