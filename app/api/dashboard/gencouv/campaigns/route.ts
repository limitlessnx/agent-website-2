import { readGencouvBrevoAllowlist } from "@/lib/gencouv-brevo-readiness";
import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders, GENCOUV_UUID, GENCOUV_SENDERS, GencouvRequestError } from "@/lib/gencouv-admin";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { db, organizationId } = await requireGencouvAdmin();
    const offsetValue = new URL(request.url).searchParams.get("offset") || "0";
    if (!/^\d{1,6}$/.test(offsetValue)) throw new GencouvRequestError("Invalid saved message page.");
    const offset = Number(offsetValue);
    const result = await db.from("gencouv_bulk_campaigns").select("id,from_email,subject,text_body,status,category_id,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).order("id", { ascending: true }).range(offset, offset + 100);
    if (result.error) throw result.error;
    return NextResponse.json({ campaigns: (result.data || []).slice(0, 100), has_more: (result.data || []).length > 100, next_offset: offset + 100 }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
async function save(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request);
    const input = await request.json().catch(() => null);
    const subject = String(input?.subject || "").trim(); const text = String(input?.text || "").trim();
    const sender = String(input?.from || "").trim().toLowerCase(); const category = String(input?.category_id || "");
    const approvedSender = GENCOUV_SENDERS.has(sender) || (await readGencouvBrevoAllowlist(db, organizationId)).includes(sender);
    if (!subject || subject.length > 200 || !text || text.length > 30000 || !approvedSender || category && !GENCOUV_UUID.test(category)) throw new GencouvRequestError("Enter a valid campaign sender, subject, message and category.");
    if (category) {
      const found = await db.from("crm_lead_categories").select("id").eq("organization_id", organizationId).eq("id", category).maybeSingle();
      if (found.error || !found.data) throw new GencouvRequestError("Category not found in Gencouv.");
    }
    const payload = { from_email: sender, subject, text_body: text, category_id: category || null, updated_at: new Date().toISOString() };
    const id = String(input?.id || "");
    if (id && !GENCOUV_UUID.test(id)) throw new GencouvRequestError("Invalid campaign ID.");
    const result = id ? await db.from("gencouv_bulk_campaigns").update(payload).eq("organization_id", organizationId).eq("id", id).eq("status", "draft").select("id,status").maybeSingle()
      : await db.from("gencouv_bulk_campaigns").insert({ ...payload, organization_id: organizationId, status: "draft", consent_confirmed_by: session.email }).select("id,status").single();
    if (result.error) throw result.error;
    if (!result.data) throw new GencouvRequestError("Only an unsent draft can be edited. Create a new campaign for new content.", 409);
    return NextResponse.json({ campaign: result.data, note: "Draft saved. No recipients were enrolled or emailed." }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
export const POST = save;
export const PATCH = save;
