import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import GencouvContactImport from "@/components/gencouv/GencouvContactImport";

export const dynamic = "force-dynamic";

export default async function GencouvContactsPage() {
  const [session, context] = await Promise.all([getAdminSession(), getAdminOrganizationContext()]);
  if (!session || context.kind !== "system" || context.id !== "gencouv") redirect("/dashboard/gencouv");
  return <main className="admin-page" style={{ padding: "24px 16px" }}>
    <header style={{ maxWidth: 1050, margin: "0 auto 24px" }}>
      <Link href="/dashboard/gencouv">← Gencouv dashboard</Link>
      <p style={{ letterSpacing: 2, fontSize: 12, opacity: .7, marginTop: 20 }}>GENCOUV · EMAIL & MARKETING</p>
      <h1>Contact imports & saved lists</h1>
      <p>Upload and organize contacts for future permission-based email campaigns.</p>
    </header>
    <GencouvContactImport />
  </main>;
}
