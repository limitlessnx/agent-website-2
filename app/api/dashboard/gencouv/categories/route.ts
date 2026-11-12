import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function scope() {
  if (!(await getAdminSession())) return null;
  try {
    const result = await requireAdminSystemScope("gencouv");
    if (result.status === "unavailable" || !uuid.test(result.organizationId)) return null;
    return result.organizationId;
  } catch { return null; }
}
const forbidden = () => NextResponse.json({ error: "Gencouv admin workspace required." }, { status: 403, headers });
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status, headers });
const originOk = (request: NextRequest) => request.headers.get("origin") === request.nextUrl.origin;

export async function GET() {
  const organizationId = await scope();
  if (!organizationId) return forbidden();
  const db = createAdminClient();
  const { data, error } = await db.from("crm_lead_categories")
    .select("id,name,description,color,created_at")
    .eq("organization_id", organizationId).order("name");
  if (error) return fail("Unable to load categories.", 500);
  return NextResponse.json({ categories: data || [] }, { headers });
}

export async function POST(request: NextRequest) {
  const organizationId = await scope();
  if (!organizationId) return forbidden();
  if (!originOk(request)) return fail("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) return fail("Category name must be between 1 and 80 characters.");
  const db = createAdminClient();
  const { data, error } = await db.from("crm_lead_categories")
    .insert({ organization_id: organizationId, name }).select("id,name,description,color,created_at").single();
  if (error) return fail(error.code === "23505" ? "Category already exists." : "Unable to create category.", error.code === "23505" ? 409 : 500);
  return NextResponse.json({ category: data }, { status: 201, headers });
}

export async function PATCH(request: NextRequest) {
  const organizationId = await scope();
  if (!organizationId) return forbidden();
  if (!originOk(request)) return fail("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!uuid.test(id) || !name || name.length > 80) return fail("Valid category ID and name are required.");
  const { data, error } = await createAdminClient().from("crm_lead_categories")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId).eq("id", id)
    .select("id,name,description,color,created_at").maybeSingle();
  if (error) return fail(error.code === "23505" ? "Category already exists." : "Unable to rename category.", error.code === "23505" ? 409 : 500);
  if (!data) return fail("Category not found.", 404);
  return NextResponse.json({ category: data }, { headers });
}

export async function DELETE(request: NextRequest) {
  const organizationId = await scope();
  if (!organizationId) return forbidden();
  if (!originOk(request)) return fail("Invalid request origin.", 403);
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!uuid.test(id)) return fail("Valid category ID required.");
  const { data, error } = await createAdminClient().from("crm_lead_categories")
    .delete().eq("organization_id", organizationId).eq("id", id).select("id").maybeSingle();
  if (error) return fail("Unable to delete category.", 500);
  if (!data) return fail("Category not found.", 404);
  return NextResponse.json({ ok: true }, { headers });
}
