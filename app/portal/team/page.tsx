import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import AccessRequestsClient from "./AccessRequestsClient";
import "./team.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team | Fluxknight" };

export default async function TeamPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["members.view","members.manage","members.invite"]); } catch { redirect("/portal"); }

  const access = await getOrganizationAccessContext(session.organizationId, session.userId);
  const canManage = access.roles.includes("owner");
  const organizations=canManage ? await supabaseServerRequest<Array<{manager_access_code:string}>>(
    `organizations?id=eq.${encodeURIComponent(session.organizationId)}&select=manager_access_code&limit=1`
  ).catch(()=>[]) : [];
  const accessCode=organizations[0]?.manager_access_code||"Unavailable";

  return <main className="portal-page">
    <section className="portal-command-hero">
      <div>
        <p className="portal-kicker">Team & Access</p>
        <h1>Organization access</h1>
        <p>{canManage ? "Invite and approve managers, control access, and review team members." : "View your organization's team members. Only the owner manages access."}</p>
      </div>
    </section>
    <AccessRequestsClient accessCode={canManage ? accessCode : ""} canManage={canManage}/>
  </main>;
}
