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
    {
      const found = await db.from("crm_customers").select("id").eq("organization_id", organizationId).ilike("email", email).maybeSingle();
      const qualified=found.data?null:await db.from("gencouv_qualified_leads").select("id").eq("organization_id",organizationId).eq("normalized_email",email).maybeSingle();
      if (found.error || qualified?.error || (!found.data&&!qualified?.data)) throw new GencouvRequestError("Contact not found.", 404);
    }
    if (action === "do_not_contact") {
      const suppressed = await db.from("gencouv_suppression_list").upsert({ organization_id: organizationId, normalized_email: email, reason: "manual_do_not_contact", source: "dashboard" }, { onConflict: "organization_id,normalized_email" });
      if (suppressed.error) throw suppressed.error;
      return NextResponse.json({ success: true, message: "Contact suppressed from future outbound email." }, { headers: gencouvPrivateHeaders });
    }
    const secret=process.env.GENCOUV_DASHBOARD_SECRET;
    if(!secret)throw new GencouvRequestError("Contact stage controls are unavailable. No email was sent.",503);
    const response=await fetch(process.env.GENCOUV_EMAIL_CONTROL_API_URL||"https://n8n.srv1720757.hstgr.cloud/webhook/gencouv-email-control",{method:"POST",headers:{"Content-Type":"application/json","x-gencouv-dashboard-secret":secret},body:JSON.stringify({action,email,organization_id:organizationId,requested_by:session.email}),signal:AbortSignal.timeout(8000),cache:"no-store"});
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.success!==true)throw new GencouvRequestError("The contact stage update was not confirmed by the connected workflow. No email was requested.",503);
    const audit=await db.from("audit_logs").insert({organization_id:organizationId,action:"gencouv.contact_stage_updated",resource_type:"gencouv_contact",resource_id:email,metadata:{actor_email:session.email,stage_action:action}});
    if(audit.error)throw audit.error;
    return NextResponse.json({success:true,message:"Contact stage updated."},{headers:gencouvPrivateHeaders});
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ success: false, error: safe.message, message: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
