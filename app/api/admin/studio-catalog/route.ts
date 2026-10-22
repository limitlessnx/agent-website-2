import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const columns = "id,title,description,category,price_amount,currency,duration_minutes,cover_image_url,media_urls,status,sort_order,created_at,updated_at";

async function xposureOrganization(permission: "systems.view" | "systems.manage") {
  const access = await authorizeXposureTenantAccess(permission);
  if (!access.ok) return { error: access.response };
  return { organizationId: access.organizationId };
}

export async function GET() {
  const access = await xposureOrganization("systems.view");
  if ("error" in access) return access.error;
  const admin = createAdminClient();
  const { data, error } = await admin.from("studio_catalog_items").select(columns)
    .eq("organization_id", access.organizationId)
    .order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: "Catalogue could not be loaded. Confirm the studio catalogue migration is applied." }, { status: 503 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: Request) {
  const access = await xposureOrganization("systems.manage");
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "A valid JSON body is required." }, { status: 400 });
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0, 80) : "Photoshoot";
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "NGN";
  const price = body.price_amount === null || body.price_amount === "" || body.price_amount === undefined ? null : Number(body.price_amount);
  const duration = body.duration_minutes === null || body.duration_minutes === "" || body.duration_minutes === undefined ? null : Number(body.duration_minutes);
  if (title.length < 2 || title.length > 140) return NextResponse.json({ error: "Title must be between 2 and 140 characters." }, { status: 400 });
  if (description.length > 4000) return NextResponse.json({ error: "Description cannot exceed 4,000 characters." }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: "Currency must be a three-letter code." }, { status: 400 });
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 9999999999)) return NextResponse.json({ error: "Enter a valid non-negative price." }, { status: 400 });
  if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 1440)) return NextResponse.json({ error: "Duration must be 5 to 1440 minutes." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("studio_catalog_items").insert({
    organization_id: access.organizationId, title, description, category: category || "Photoshoot",
    currency, price_amount: price, duration_minutes: duration, status: "draft",
  }).select(columns).single();
  if (error) return NextResponse.json({ error: "Catalogue item could not be saved. Confirm the studio catalogue migration is applied." }, { status: 503 });
  return NextResponse.json({ item: data }, { status: 201 });
}
