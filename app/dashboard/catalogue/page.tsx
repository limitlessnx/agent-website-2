import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import StudioCatalogue from "@/components/admin/StudioCatalogue";

export const dynamic = "force-dynamic";

type Item = {
  id: string; title: string; description: string; category: string;
  price_amount: number | null; currency: string; duration_minutes: number | null;
  cover_image_url: string | null; status: string; created_at: string;
};

export default async function XposureCataloguePage() {
  const scope = await resolveAdminOrganizationScope();
  if (scope.kind !== "tenant" || scope.slug !== "xposure" || !scope.organizationId) {
    return <main className="admin-page" style={{ maxWidth: 900, margin: "0 auto", padding: 28 }}>
      <h1>Studio catalogue</h1>
      <p>This screen is only available in the Xposure Studios workspace.</p>
      <a href="/dashboard">Return to dashboard</a>
    </main>;
  }
  const admin = createAdminClient();
  const result = await admin.from("studio_catalog_items")
    .select("id,title,description,category,price_amount,currency,duration_minutes,cover_image_url,media_urls,status,created_at")
    .eq("organization_id", scope.organizationId)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(200);

  return <main className="admin-page" style={{ maxWidth: 1180, margin: "0 auto", padding: "clamp(18px, 3vw, 32px)", color: "var(--fk-text, #f5f2fa)" }}>
    <header style={{ marginBottom: 24 }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: "var(--fk-muted, #a9a1b5)", marginBottom: 8 }}>Xposure Studios · Services &amp; media</p>
      <h1 style={{ fontSize: "clamp(28px,4vw,38px)", letterSpacing: "-.04em", margin: 0 }}>Studio catalogue</h1>
      <p style={{ color: "var(--fk-muted, #a9a1b5)", maxWidth: 680, lineHeight: 1.6, marginTop: 10 }}>Manage photoshoot packages and approved studio reference material. Catalogue entries are kept separate from real-estate property inventory.</p>
    </header>
    <StudioCatalogue initialItems={(result.error ? [] : result.data || []) as Item[]} unavailable={Boolean(result.error)} />
  </main>;
}
