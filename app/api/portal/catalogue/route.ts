import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { assertAnyOrganizationPermission, getOrganizationAccessContext } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  action?: string;
  categoryId?: string;
  name?: string;
  description?: string;
  status?: string;
  priceMinor?: number | string | null;
  currency?: string;
  durationMinutes?: number | string | null;
  mediaUrl?: string | null;
  mediaAltText?: string | null;
  itemId?: string;
  mediaId?: string;
};

function nullableNumber(value: unknown, minimum = 0) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum ? Math.round(number) : null;
}

async function getAuthorizedSession() {
  const session = await getClientSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") return { error: NextResponse.json({ error: "Xposure catalogue is only available to photography workspaces." }, { status: 403 }) } as const;
  try {
    const access = await getOrganizationAccessContext(session.organizationId, session.userId);
    assertAnyOrganizationPermission(access, ["customers.manage", "systems.manage"]);
  } catch {
    return { error: NextResponse.json({ error: "Catalogue management permission required." }, { status: 403 }) } as const;
  }
  return { session } as const;
}

export async function GET() {
  const authorized = await getAuthorizedSession();
  if ("error" in authorized) return authorized.error;
  const admin = createAdminClient();
  const { data, error } = await admin.from("photography_catalogue_items").select("id,category_id,name,description,status,price_minor,currency,duration_minutes,availability,metadata,photography_catalogue_media(id,storage_path,alt_text,display_order,status)").eq("organization_id", authorized.session.organizationId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load catalogue items." }, { status: 500 });
  return NextResponse.json({ ok: true, items: data || [] });
}

export async function POST(request: Request) {
  const authorized = await getAuthorizedSession();
  if ("error" in authorized) return authorized.error;
  const body = await request.json().catch(() => ({})) as Body;
  const action = String(body.action || "save");
  const organizationId = authorized.session.organizationId;
  const admin = createAdminClient();
  if (action === "archive") {
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Catalogue item id is required." }, { status: 400 });
    const { data, error } = await admin.from("photography_catalogue_items").update({ status: "archived", updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: "Unable to archive catalogue item." }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  }
  if (action === "restore") {
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Catalogue item id is required." }, { status: 400 });
    const { data, error } = await admin.from("photography_catalogue_items").update({ status: "draft", updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: "Unable to restore catalogue item." }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  }
  if (action === "add_media") {
    const itemId = String(body.itemId || "").trim();
    const mediaUrl = String(body.mediaUrl || "").trim().slice(0, 2000);
    if (!itemId || !mediaUrl) return NextResponse.json({ error: "Package and sample image URL are required." }, { status: 400 });
    const { data: item } = await admin.from("photography_catalogue_items").select("id").eq("organization_id", organizationId).eq("id", itemId).maybeSingle();
    if (!item) return NextResponse.json({ error: "Catalogue item was not found in this workspace." }, { status: 404 });
    const { data, error } = await admin.from("photography_catalogue_media").insert({ organization_id: organizationId, item_id: itemId, storage_path: mediaUrl, alt_text: String(body.mediaAltText || "Studio sample").trim().slice(0, 240), media_type: "image", status: "active" }).select().single();
    if (error) return NextResponse.json({ error: "Unable to attach sample media." }, { status: 400 });
    return NextResponse.json({ ok: true, media: data });
  }
  if (action === "remove_media") {
    const mediaId = String(body.mediaId || "").trim();
    if (!mediaId) return NextResponse.json({ error: "Media id is required." }, { status: 400 });
    const { data, error } = await admin.from("photography_catalogue_media").update({ status: "archived", updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", mediaId).select().single();
    if (error) return NextResponse.json({ error: "Unable to archive sample media." }, { status: 400 });
    return NextResponse.json({ ok: true, media: data });
  }
  const name = String(body.name || "").trim().slice(0, 160);
  const categoryId = String(body.categoryId || "").trim();
  const description = String(body.description || "").trim().slice(0, 2000);
  const status = ["draft", "active", "archived"].includes(String(body.status)) ? String(body.status) : "draft";
  const currency = String(body.currency || "NGN").trim().toUpperCase().slice(0, 3);
  const priceMinor = nullableNumber(body.priceMinor);
  const durationMinutes = nullableNumber(body.durationMinutes, 1);
  if (!name || !categoryId) return NextResponse.json({ error: "Package name and category are required." }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "Currency must be a three-letter code." }, { status: 400 });
  const { data: category } = await admin.from("photography_catalogue_categories").select("id").eq("organization_id", organizationId).eq("id", categoryId).maybeSingle();
  if (!category) return NextResponse.json({ error: "Catalogue category was not found in this workspace." }, { status: 400 });
  const row = { organization_id: organizationId, category_id: categoryId, name, description, status, price_minor: priceMinor, currency, duration_minutes: durationMinutes, updated_at: new Date().toISOString() };
  const id = String(body.id || "").trim();
  const result = id
    ? await admin.from("photography_catalogue_items").update(row).eq("organization_id", organizationId).eq("id", id).select().single()
    : await admin.from("photography_catalogue_items").insert({ ...row, availability: {}, metadata: {} }).select().single();
  if (result.error || !result.data) return NextResponse.json({ error: "Unable to save catalogue item." }, { status: 400 });
  const mediaUrl = String(body.mediaUrl || "").trim().slice(0, 2000);
  if (mediaUrl) {
    const { error: mediaError } = await admin.from("photography_catalogue_media").insert({ organization_id: organizationId, item_id: result.data.id, storage_path: mediaUrl, alt_text: String(body.mediaAltText || name).trim().slice(0, 240), media_type: "image", status: "active" });
    if (mediaError) return NextResponse.json({ ok: true, item: result.data, warning: "Package saved, but sample media could not be attached." });
  }
  return NextResponse.json({ ok: true, item: result.data });
}
