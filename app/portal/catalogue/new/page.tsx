import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import CatalogueItemForm from "../CatalogueItemForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Catalogue Item | Fluxknight" };

type CategoryRow = { id: string; name: string; status: string };

export default async function NewCatalogueItemPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["customers.manage", "systems.manage"]); } catch { redirect("/portal/catalogue"); }
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") redirect("/portal");
  const admin = createAdminClient();
  const { data } = await admin.from("photography_catalogue_categories").select("id,name,status").eq("organization_id", session.organizationId).eq("status", "active").order("display_order", { ascending: true });
  const categories = ((data || []) as CategoryRow[]).map((category) => ({ id: String(category.id), name: String(category.name) }));
  return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">Xposure Studios · Studio Catalogue</p><h1>Add a catalogue package</h1><p>Create a package your team can use when quoting, booking and following up with studio clients.</p></div></section>{categories.length ? <section className="exposure-panel"><div className="portal-card-head"><div><h2>Package details</h2><p>Keep pricing, duration and sample media in one tenant-scoped record.</p></div></div><CatalogueItemForm categories={categories} /></section> : <section className="exposure-panel"><h2>Categories are not ready yet</h2><p>Apply the Xposure photography records migration before creating catalogue packages.</p></section>}</main>;
}
