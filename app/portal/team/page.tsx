import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import AccessRequestsClient from "./AccessRequestsClient";

// Phase 2 guardrail path marker.\nexport const dynamic = "force-dynamic";
export const metadata = { title: "Team | Fluxknight" };

export default async function TeamPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["members.view","members.manage","members.invite"]); } catch { redirect("/portal"); }

  const organizations=await supabaseServerRequest<Array<{manager_access_code:string}>>(
    `organizations?id=eq.${encodeURIComponent(session.organizationId)}&select=manager_access_code&limit=1`
  ).catch(()=>[]);
  const accessCode=organizations[0]?.manager_access_code||"Unavailable";

  return <main className="portal-page">
    <section className="portal-command-hero">
      <div>
        <p className="portal-kicker">Team & Access</p>
        <h1>Organization access</h1>
        <p>Manage the organization Access ID, approve manager requests, and control active manager access.</p>
      </div>
    </section>
    <AccessRequestsClient accessCode={accessCode}/>
  </main>;
}
