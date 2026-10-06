import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { listOrganizationMembers } from "@/lib/organization-membership";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import AccessRequestsClient from "./AccessRequestsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team | Fluxknight" };

export default async function TeamPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["members.view","members.manage","members.invite"]); } catch { redirect("/portal"); }
  const members = await listOrganizationMembers(session.organizationId, session.userId).catch(() => []);
  const organizations=await supabaseServerRequest<Array<{manager_access_code:string}>>(`organizations?id=eq.${encodeURIComponent(session.organizationId)}&select=manager_access_code&limit=1`).catch(()=>[]);
  const accessCode=organizations[0]?.manager_access_code||"Unavailable";
  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">Team</p><h1>Organization access</h1><p>People who can access this workspace and the role currently assigned to each membership.</p></div></section>
    <AccessRequestsClient accessCode={accessCode}/>
    <section className="portal-card"><div className="portal-list">{members.map((member)=><div className="portal-list-row" key={member.id}><div><strong>{member.email || member.user_id}</strong><span>{member.role.replaceAll("-"," ")} · {member.status}</span></div></div>)}{!members.length?<p className="portal-empty">No team members found.</p>:null}</div></section>
  </main>;
}
