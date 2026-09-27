import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { listWritableGoogleCalendars } from "@/lib/google-calendar-oauth";
import { getValidGoogleCalendarAccessToken } from "@/lib/calendar-provider";

export async function POST(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{
    return NextResponse.json({error:"integrations.manage required"},{status:403});
  }
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const calendarId=String(body.calendarId||"").trim();
  if(!calendarId) return NextResponse.json({error:"calendarId is required"},{status:400});

  const admin=createAdminClient();
  const {data:integration,error:integrationError}=await admin.from("organization_integrations")
    .select("id,configuration")
    .eq("organization_id",session.organizationId)
    .eq("provider","google_calendar")
    .maybeSingle();
  if(integrationError) return NextResponse.json({error:integrationError.message},{status:400});
  if(!integration) return NextResponse.json({error:"Google Calendar is not connected"},{status:404});

  try{
    const {accessToken}=await getValidGoogleCalendarAccessToken(session.organizationId,"google_calendar");
    const calendars=await listWritableGoogleCalendars(accessToken);
    const selected=calendars.find((item)=>item.id===calendarId);
    if(!selected) return NextResponse.json({error:"Selected calendar is not writable or no longer available"},{status:400});

    const {data:resourceId,error:resourceError}=await (admin as any).rpc("upsert_appointment_calendar_resource",{
      p_organization_id:session.organizationId,
      p_integration_id:integration.id,
      p_provider:"google_calendar",
      p_external_calendar_id:selected.id,
      p_display_name:selected.summary,
      p_organizer_email:String((integration.configuration as Record<string,unknown>|null)?.connected_email||"")||null,
      p_timezone:selected.timeZone||"Africa/Lagos",
      p_default_duration_minutes:60,
      p_is_default:true,
      p_availability_configuration:{},
      p_metadata:{access_role:selected.accessRole,primary:selected.primary},
    });
    if(resourceError) throw resourceError;

    const {error:updateError}=await admin.from("organization_integrations").update({
      status:"connected",
      configuration:{
        ...((integration.configuration||{}) as Record<string,unknown>),
        selected_calendar_id:selected.id,
        selected_calendar_name:selected.summary,
        selected_calendar_timezone:selected.timeZone,
        calendar_selection_pending:false,
      },
      health:{state:"ready",message:"Google Calendar is connected and writable."},
      last_checked_at:new Date().toISOString(),
      last_connected_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId).eq("id",integration.id);
    if(updateError) throw updateError;

    return NextResponse.json({ok:true,resourceId,calendar:selected});
  }catch(error){
    await admin.from("organization_integrations").update({
      status:"degraded",
      health:{state:"degraded",message:error instanceof Error?error.message:"Google Calendar readiness failed."},
      last_checked_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId).eq("id",integration.id);
    return NextResponse.json({error:error instanceof Error?error.message:"Google Calendar readiness failed"},{status:400});
  }
}
