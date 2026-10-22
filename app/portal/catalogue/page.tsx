import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChevronRight, Plus } from "@/components/admin/ServerIcons";
import CatalogueManager from "./CatalogueManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio Catalogue | Fluxknight" };

const categories = [
  ["Portraits", "Individual portraits, headshots and personal branding sessions", "24 items", "/exposure/portraits.jpg"],
  ["Weddings", "Couples, ceremonies and full wedding-day packages", "36 items", "/exposure/weddings.jpg"],
  ["Maternity", "Maternity, newborn and family milestone sessions", "18 items", "/exposure/maternity.jpg"],
  ["Birthdays", "Birthday portraits, celebrations and event coverage", "22 items", "/exposure/birthdays.jpg"],
  ["Family", "Family sessions, lifestyle portraits and group packages", "16 items", "/exposure/family.jpg"],
  ["Creative sets", "Studio concepts, seasonal sets and campaign-ready ideas", "12 items", "/exposure/creative-sets.jpg"],
] as const;
const fallbackImageBySlug: Record<string, string> = Object.fromEntries(categories.map(([name, , , image]) => [name.toLowerCase().replaceAll(" ", "-"), image]));
type CatalogueCategoryRow = { id: string; slug: string; name: string; description: string | null; cover_image_url: string | null; display_order: number };
type CatalogueItemRow = { category_id: string };
type CataloguePackageRow = { id: string; category_id: string; name: string; description: string | null; status: string; price_minor: number | null; currency: string; duration_minutes: number | null };
type CatalogueMediaRow = { id: string; item_id: string; storage_path: string; alt_text: string | null; status: string };

export default async function CataloguePage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["customers.view"]); } catch { redirect("/portal"); }
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") redirect("/portal");
  const admin = createAdminClient();
  const [categoryResult, itemResult, packageResult, mediaResult] = await Promise.all([
    (async () => { try { return await admin.from("photography_catalogue_categories").select("id,slug,name,description,cover_image_url,display_order").eq("organization_id", session.organizationId).eq("status", "active").order("display_order", { ascending: true }) as { data: CatalogueCategoryRow[] | null }; } catch { return { data: null as CatalogueCategoryRow[] | null }; } })(),
    (async () => { try { return await admin.from("photography_catalogue_items").select("category_id").eq("organization_id", session.organizationId).eq("status", "active") as { data: CatalogueItemRow[] | null }; } catch { return { data: null as CatalogueItemRow[] | null }; } })(),
    (async () => { try { return await admin.from("photography_catalogue_items").select("id,category_id,name,description,status,price_minor,currency,duration_minutes").eq("organization_id", session.organizationId).order("created_at", { ascending: false }) as { data: CataloguePackageRow[] | null }; } catch { return { data: null as CataloguePackageRow[] | null }; } })(),
    (async () => { try { return await admin.from("photography_catalogue_media").select("id,item_id,storage_path,alt_text,status").eq("organization_id", session.organizationId).order("display_order", { ascending: true }) as { data: CatalogueMediaRow[] | null }; } catch { return { data: null as CatalogueMediaRow[] | null }; } })(),
  ]);
  const itemCounts = new Map<string, number>();
  for (const item of itemResult.data || []) itemCounts.set(String(item.category_id), (itemCounts.get(String(item.category_id)) || 0) + 1);
  const liveCategories: Array<{ name: string; description: string; count: string; image: string }> = (categoryResult.data || []).map((item) => ({ name: String(item.name), description: String(item.description || ""), count: `${itemCounts.get(String(item.id)) || 0} items`, image: String(item.cover_image_url || fallbackImageBySlug[String(item.slug)] || "/exposure/creative-sets.jpg") }));
  const displayCategories: Array<{ name: string; description: string; count: string; image: string }> = liveCategories.length ? liveCategories : categories.map(([name, description, count, image]) => ({ name, description, count, image }));
  const managerItems = (packageResult.data || []).map((item) => ({ ...item, description: item.description || "", media: (mediaResult.data || []).filter((media) => media.item_id === item.id).map((media) => ({ id: media.id, storage_path: media.storage_path, alt_text: media.alt_text || "", status: media.status })) }));
  const managerCategories = (categoryResult.data || []).map((category) => ({ id: String(category.id), name: String(category.name) }));
  return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">Xposure Studios</p><h1>Studio Catalogue</h1><p>Organize the shoot packages, categories and creative sets your team shares with clients.</p></div><Link className="portal-button" href="/portal/catalogue/new"><Plus size={16} /> Add catalogue item</Link></section><section className="exposure-catalogue-grid exposure-catalogue-page-grid">{displayCategories.map(({ name, description, count, image }) => <Link href={`/portal/catalogue?category=${encodeURIComponent(name)}`} key={name}><img className="exposure-catalogue-art" src={image} alt="" /><div><strong>{name}</strong><small>{description}</small></div><em>{count}</em><ChevronRight size={15} /></Link>)}</section>{managerCategories.length ? <CatalogueManager initialItems={managerItems} categories={managerCategories} /> : null}<section className="exposure-panel"><header><div><p className="portal-kicker">Catalogue data layer</p><h2>Packages and sample media stay tenant-scoped</h2><p>Categories are connected to studio packages, prices, availability and sample media through the Xposure photography records.</p></div><Link className="portal-button secondary" href="/portal/settings">Studio settings <ChevronRight size={15} /></Link></header></section></main>;
}
