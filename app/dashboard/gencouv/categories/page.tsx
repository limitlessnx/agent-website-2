import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import GencouvCategories from "@/components/gencouv/GencouvCategories";

export const dynamic = "force-dynamic";

export default async function GencouvCategoriesPage() {
  const [session, context] = await Promise.all([getAdminSession(), getAdminOrganizationContext()]);
  if (!session || context.kind !== "system" || context.id !== "gencouv") redirect("/dashboard/gencouv");
  return <main className="admin-page" style={{maxWidth:960,margin:"0 auto",padding:"24px 16px"}}>
    <Link href="/dashboard/gencouv">← Gencouv dashboard</Link>
    <header style={{marginTop:24}}>
      <p style={{letterSpacing:2,fontSize:12,opacity:.7}}>GENCOUV · EMAIL CENTRE</p>
      <h1>Lead segmentation</h1>
      <p>Organize contacts using categories you create and manage yourself.</p>
    </header>
    <GencouvCategories />
  </main>;
}
