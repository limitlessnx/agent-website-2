import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import OrganizationCreationWizard from "../OrganizationCreationWizard";

export const dynamic = "force-dynamic";

export default async function CreateOrganizationPage() {
  if (!await getAdminSession()) redirect("/login?next=/dashboard/clients/create");
  const { data, error } = await createAdminClient().from("organization_templates")
    .select("slug,name,industry,description").eq("status", "active").order("name");
  if (error) throw new Error("Organization templates could not be loaded. Review platform configuration.");
  return <main className="admin-page">
    <header className="admin-page-header"><div><p className="admin-kicker">Client setup</p><h1>Create organization</h1><p>Create a starter workspace, then review its configuration, testing and approval gates.</p></div><Link className="admin-button secondary" href="/dashboard/clients">Back to clients</Link></header>
    <OrganizationCreationWizard templates={data || []} />
  </main>;
}
