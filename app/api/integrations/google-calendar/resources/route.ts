import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidGoogleCalendarAccessToken } from "@/lib/calendar-provider";
import { listWritableGoogleCalendars } from "@/lib/google-calendar-oauth";

export async function POST(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage","appointments.manage"]);}catch{
    return NextResponse.json({error:"Calendar management permission required"},{status:403});
  }

  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const calendarId=String(body.calendarId||"").trim();
  if(!calendarId) return NextResponse.json({error:"calendarId is required"},{status:400});
  const assignedMembershipId=body.assignedMembershipId===null?null:String(body.assignedMembershipId||"").trim()||null;
  const duration=Math.max(5,Math.min(1440,Number(body.defaultDurationMinutes)||60));
  const makeDefault=body.isDefault!==false;

  const admin=createAdminClient();
  const {data:integration,error:integrationError}=await admin.from("organization_integrations")
    .select("id,configuration,status")
    .eq("organization_id",session.organizationId)
    .eq("provider","google_calendar")
    .maybeSingle();
  if(integrationError) return NextResponse.json({error:integrationError.message},{status:400});
  if(!integration) return NextResponse.json({error:"Google Calendar is not connected"},{status:404});

  try{
    const {accessToken}=await getValidGoogleCalendarAccessToken(session.organizationId,"google_calendar");
    const calendars=await listWritableGoogleCalendars(accessToken);
    const selected=calendars.find((item)=>item.id===calendarId);
    if(!selected) return NextResponse.json({error:"Selected calendar is not writable"},{status:400});
    const timezone=String(body.timezone||selected.timeZone||"Africa/Lagos").trim();

    const {data:resourceId,error:resourceError}=await (admin as any).rpc("upsert_appointment_calendar_resource",{
      p_organization_id:session.organizationId,
      p_integration_id:integration.id,
      p_provider:"google_calendar",
      p_external_calendar_id:selected.id,
      p_display_name:selected.summary,
      p_organizer_email:String((integration.configuration as Record<string,unknown>|null)?.connected_email||"")||null,
      p_timezone:timezone,
      p_default_duration_minutes:duration,
      p_is_default:makeDefault,
      p_availability_configuration:{},
      p_metadata:{access_role:selected.accessRole,primary:selected.primary},
    });
    if(resourceError) throw resourceError;

    const {data:settings,error:settingsError}=await (admin as any).rpc("update_appointment_calendar_resource_settings",{
      p_organization_id:session.organizationId,
      p_resource_id:resourceId,
      p_assigned_membership_id:assignedMembershipId,
      p_timezone:timezone,
      p_default_duration_minutes:duration,
      p_is_default:makeDefault,
      p_status:"active",
      p_availability_configuration:{},
    });
    if(settingsError) throw settingsError;

    return NextResponse.json({ok:true,resourceId,settings,calendar:selected});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to add calendar resource"},{status:400});
  }
}
