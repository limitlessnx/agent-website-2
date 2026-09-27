import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertGoogleCalendarScopes,
  exchangeGoogleCalendarCode,
  getGoogleConnectedEmail,
  listWritableGoogleCalendars,
  verifyGoogleCalendarState,
} from "@/lib/google-calendar-oauth";

function redirect(request:NextRequest,status:string){
  const url=new URL("/portal/integrations",request.url);
  url.searchParams.set("google_calendar",status);
  return NextResponse.redirect(url);
}

export async function GET(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.redirect(new URL("/account/login",request.url));
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{return redirect(request,"forbidden");}

  const error=request.nextUrl.searchParams.get("error");
  if(error) return redirect(request,"cancelled");

  const code=String(request.nextUrl.searchParams.get("code")||"");
  const state=String(request.nextUrl.searchParams.get("state")||"");
  const cookieState=request.cookies.get("flux_google_calendar_oauth_state")?.value||"";
  const verified=verifyGoogleCalendarState(state);
  if(!code||!state||state!==cookieState||!verified
    ||verified.organizationId!==session.organizationId||verified.userId!==session.userId){
    return redirect(request,"invalid_state");
  }

  try{
    const tokens=await exchangeGoogleCalendarCode({origin:request.nextUrl.origin,code});
    assertGoogleCalendarScopes(tokens.scope);
    const [email,calendars]=await Promise.all([
      getGoogleConnectedEmail(tokens.accessToken),
      listWritableGoogleCalendars(tokens.accessToken),
    ]);
    if(!calendars.length) throw new Error("No writable Google calendars were found for this account.");

    const admin=createAdminClient();
    const {data:integration,error:integrationError}=await admin.from("organization_integrations")
      .select("id,configuration")
      .eq("organization_id",session.organizationId)
      .eq("provider","google_calendar")
      .maybeSingle();
    if(integrationError) throw integrationError;
    if(!integration) throw new Error("Google Calendar integration was not initialized.");

    let refreshToken=tokens.refreshToken;
    if(!refreshToken){
      const {data:existing}=await (admin as any).rpc("get_organization_integration_credentials",{
        p_organization_id:session.organizationId,
        p_provider:"google_calendar",
      });
      if(existing&&typeof existing==="object"){
        const value=(existing as Record<string,unknown>).refresh_token;
        if(typeof value==="string"&&value.trim()) refreshToken=value.trim();
      }
    }
    if(!refreshToken) throw new Error("Google did not return offline access. Reconnect and approve Calendar access.");

    const expiresAt=new Date(Date.now()+tokens.expiresIn*1000).toISOString();
    const safeCalendars=calendars.map((item)=>({
      id:item.id,summary:item.summary,primary:item.primary,accessRole:item.accessRole,timeZone:item.timeZone,
    }));
    const {error:credentialError}=await (admin as any).rpc("upsert_integration_credentials",{
      p_integration_id:integration.id,
      p_credentials:{
        access_token:tokens.accessToken,
        refresh_token:refreshToken,
        expires_at:expiresAt,
        scope:tokens.scope,
        token_type:tokens.tokenType,
        connected_email:email,
      },
      p_configuration:{
        provider_model:"platform_google_oauth",
        connected_email:email,
        available_calendars:safeCalendars,
        calendar_selection_pending:true,
      },
      p_actor_email:session.email,
    });
    if(credentialError) throw credentialError;

    const response=redirect(request,"select");
    response.cookies.delete("flux_google_calendar_oauth_state");
    return response;
  }catch(error){
    console.error("Google Calendar OAuth callback failed",{
      organizationId:session.organizationId,
      error:error instanceof Error?error.message:String(error),
    });
    const response=redirect(request,"error");
    response.cookies.delete("flux_google_calendar_oauth_state");
    return response;
  }
}
