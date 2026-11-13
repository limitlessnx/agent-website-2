import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import GencouvMarketingWorkspace from "@/components/gencouv/GencouvMarketingWorkspace";
export const dynamic = "force-dynamic";
export default async function GencouvMarketingPage(){
 const [session,context]=await Promise.all([getAdminSession(),getAdminOrganizationContext()]);
 if(!session||context.kind!=="system"||context.id!=="gencouv")redirect("/dashboard/gencouv");
 return <main className="admin-page" style={{padding:"24px 16px"}}>
  <header style={{maxWidth:1060,margin:"0 auto 24px"}}>
   <Link href="/dashboard/gencouv">← Gencouv dashboard</Link>
   <p style={{letterSpacing:2,fontSize:12,opacity:.7,marginTop:20}}>GENCOUV · EMAIL & PROPOSALS</p>
   <h1>Campaign audiences & proposals</h1>
   <p>Review saved contacts, build audiences and compose one-to-one business correspondence.</p>
  </header>
  <GencouvMarketingWorkspace />
 </main>;
}