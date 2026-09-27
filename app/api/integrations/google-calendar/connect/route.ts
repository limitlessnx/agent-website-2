import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGoogleCalendarState, googleCalendarAuthorizationUrl } from "@/lib/google-calendar-oauth";

export async function GET(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.redirect(new URL("/account/login",request.url));
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{
    return NextResponse.redirect(new URL("/portal/integrations?google_calendar=forbidden",request.url));
  }

  const admin=createAdminClient();
  const {data:existing,error:findError}=await admin.from("organization_integrations")
    .select("id,status")
    .eq("organization_id",session.organizationId)
    .eq("provider","google_calendar")
    .maybeSingle();
  if(findError) throw findError;

  if(!existing){
    const {error:insertError}=await admin.from("organization_integrations").insert({
      organization_id:session.organizationId,
      provider:"google_calendar",
      display_name:"Google Calendar",
      status:"disconnected",
      configuration:{provider_model:"platform_google_oauth"},
      health:{state:"disconnected",message:"Google Calendar is not connected."},
    });
    if(insertError) throw insertError;
  }

  const state=createGoogleCalendarState({
    organizationId:session.organizationId,
    userId:session.userId,
  });
  const target=googleCalendarAuthorizationUrl({origin:request.nextUrl.origin,state});
  const response=NextResponse.redirect(target);
  response.cookies.set("flux_google_calendar_oauth_state",state,{
    httpOnly:true,
    sameSite:"lax",
    secure:process.env.NODE_ENV==="production",
    maxAge:15*60,
    path:"/",
  });
  return response;
}
