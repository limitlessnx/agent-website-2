import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders, GencouvRequestError, GENCOUV_EMAIL } from "@/lib/gencouv-admin";
import { getGencouvCampaignSettings, updateGencouvCampaignSettings } from "@/lib/gencouv-campaign-settings";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request); const input = await request.json().catch(() => null);
    const action = String(input?.action || "");
    if (action === "update_daily_limit") return NextResponse.json(await updateGencouvCampaignSettings(db, organizationId, session.email, null, Number(input?.daily_limit)), { headers: gencouvPrivateHeaders });
    if (["pause_sequence", "stop_sequence"].includes(action)) return NextResponse.json(await updateGencouvCampaignSettings(db, organizationId, session.email, false, null), { headers: gencouvPrivateHeaders });
    if (action === "preview_sequence") return NextResponse.json({ success: true, ...await getGencouvCampaignSettings(db, organizationId), message: "Preview only. No recipient was enrolled or emailed. Open Follow-ups to review saved sequence drafts." }, { headers: gencouvPrivateHeaders });
    if (!["mark_hot", "mark_warm", "mark_cold", "move_following_up", "move_onboarding", "do_not_contact"].includes(action)) throw new GencouvRequestError("Unsupported email control action.");
    const email = String(input?.email || "").trim().toLowerCase();
    if (!GENCOUV_EMAIL.test(email)) throw new GencouvRequestError("Choose a specific contact in Contacts & CRM before changing its follow-up state.");
    const result = await db.rpc("gencouv_update_contact_stage", {
      p_organization_id: organizationId, p_email: email, p_action: action, p_actor: session.email,
    });
    if (result.error) {
      if (String(result.error.message).includes("Contact not found")) throw new GencouvRequestError("Contact not found.", 404);
      throw new GencouvRequestError("Contact update could not be saved. No email was requested.", 503);
    }
    return NextResponse.json(result.data, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ success: false, error: safe.message, message: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
