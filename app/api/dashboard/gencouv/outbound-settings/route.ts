import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders, GencouvRequestError } from "@/lib/gencouv-admin";
import { getGencouvCampaignSettings, updateGencouvCampaignSettings } from "@/lib/gencouv-campaign-settings";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const { db, organizationId } = await requireGencouvAdmin(); return NextResponse.json(await getGencouvCampaignSettings(db, organizationId), { headers: gencouvPrivateHeaders }); }
  catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
export async function POST(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request); const input = await request.json().catch(() => null);
    if (!input || input.confirmed !== true || typeof input.enabled !== "boolean") throw new GencouvRequestError("Explicit campaign state and confirmation are required.");
    const result = await updateGencouvCampaignSettings(db, organizationId, session.email, input.enabled, null);
    return NextResponse.json({ ...result, note: result.message }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
