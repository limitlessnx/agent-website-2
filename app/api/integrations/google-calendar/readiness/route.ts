import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidGoogleCalendarAccessToken } from "@/lib/calendar-provider";
import { listWritableGoogleCalendars } from "@/lib/google-calendar-oauth";

export async function GET(){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.view","integrations.manage"]);}catch{
    return NextResponse.json({error:"Integration access required"},{status:403});
  }

  const admin=createAdminClient();
  const [{data:integration,error:integrationError},{data:resources,error:resourceError}]=await Promise.all([
    admin.from("organization_integrations")
      .select("id,status,configuration,health,last_connected_at")
      .eq("organization_id",session.organizationId)
      .eq("provider","google_calendar")
      .maybeSingle(),
    admin.from("appointment_calendar_resources")
      .select("id,external_calendar_id,display_name,timezone,status,is_default")
      .eq("organization_id",session.organizationId)
      .eq("provider","google_calendar")
      .order("is_default",{ascending:false}),
  ]);
  if(integrationError) return NextResponse.json({error:integrationError.message},{status:400});
  if(resourceError) return NextResponse.json({error:resourceError.message},{status:400});
  if(!integration||integration.status==="disconnected"){
    return NextResponse.json({ok:true,state:"disconnected",ready:false});
  }

  try{
    const {accessToken}=await getValidGoogleCalendarAccessToken(session.organizationId,"google_calendar");
    const calendars=await listWritableGoogleCalendars(accessToken);
    const resource=(resources||[]).find((item)=>item.status==="active"&&item.is_default)
      ||(resources||[]).find((item)=>item.status==="active")
      ||null;

    if(!resource){
      await admin.from("organization_integrations").update({
        status:"configured",
        configuration:{
          ...((integration.configuration||{}) as Record<string,unknown>),
          available_calendars:calendars,
          calendar_selection_pending:true,
        },
        health:{state:"selection_required",message:"Choose the calendar Fluxknight should use for appointments."},
        last_checked_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      }).eq("organization_id",session.organizationId).eq("id",integration.id);
      return NextResponse.json({ok:true,state:"selection_required",ready:false,calendars});
    }

    const writable=calendars.find((item)=>item.id===resource.external_calendar_id);
    if(!writable){
      throw new Error("The selected Google Calendar is no longer writable. Choose another calendar.");
    }

    await admin.from("organization_integrations").update({
      status:"connected",
      health:{state:"ready",message:"Google Calendar is connected and writable."},
      last_checked_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId).eq("id",integration.id);

    return NextResponse.json({
      ok:true,
      state:"ready",
      ready:true,
      calendar:{
        id:resource.external_calendar_id,
        name:resource.display_name,
        timezone:resource.timezone,
      },
    });
  }catch(error){
    const message=error instanceof Error?error.message:"Google Calendar readiness check failed.";
    await admin.from("organization_integrations").update({
      status:"degraded",
      health:{state:"degraded",message},
      last_checked_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId).eq("id",integration.id);
    return NextResponse.json({ok:false,state:"degraded",ready:false,error:message},{status:400});
  }
}
