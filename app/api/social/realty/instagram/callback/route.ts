import {NextRequest,NextResponse} from "next/server";
import {getAdminSession} from "@/lib/admin-auth";
import {createAdminClient} from "@/lib/supabase/admin";
import {requireRealtySocialAdmin} from "@/lib/social-real-estate-access";
import {getMetaIntegration} from "@/lib/meta-integration";
import {exchangeInstagramCode,INSTAGRAM_LOGIN_SCOPES} from "@/lib/instagram-login";
import {verifyRealtyInstagramState,realtyInstagramCookie} from "@/lib/social-realty-instagram-state";
import {realtyInstagramApp,realtyInstagramOrigin,REALTY_INSTAGRAM_CALLBACK,FLUX_SOCIAL_ORGANIZATION} from "@/lib/social-realty-instagram";

class ConnectionError extends Error {}

export async function GET(request:NextRequest){
  const url=new URL(request.url);let target=new URL("/dashboard/social/integrations",url.origin);
  try{
    const session=await getAdminSession();if(!session)throw new Error("Sign-in required.");
    const {organizationId}=await requireRealtySocialAdmin();
    const origin=realtyInstagramOrigin(request);target=new URL("/dashboard/social/integrations",origin);
    const state=verifyRealtyInstagramState(url.searchParams.get("state")||"",request.cookies.get(realtyInstagramCookie())?.value||"",session.email,session.issuedAt);
    const code=url.searchParams.get("code");if(!state||!code||url.searchParams.has("error"))throw new ConnectionError("Instagram authorization expired, was cancelled or did not match this administrator browser. Reconnect to try again.");
    const [{appId,appSecret,own},integration,platform]=await Promise.all([realtyInstagramApp(),getMetaIntegration(organizationId),getMetaIntegration(FLUX_SOCIAL_ORGANIZATION)]);
    const result=await exchangeInstagramCode({appId,appSecret,redirectUri:new URL(REALTY_INSTAGRAM_CALLBACK,origin).href,code,apiVersion:"v24.0"});
    if(!result.userId||!result.username||result.username.toLowerCase()!==state.account)throw new ConnectionError("The authorized account does not match the requested Limitless Realty handle. Reconnect with the correct account.");
    const platformConfig=(platform?.configuration||{}) as Record<string,unknown>;
    const platformIds=[platformConfig.instagram_login_user_id,platformConfig.instagram_business_account_id].filter(Boolean).map(String);
    const platformHandles=[platformConfig.instagram_username,platformConfig.instagram_login_username].filter(Boolean).map(v=>String(v).replace(/^@/,"").toLowerCase());
    if(platformIds.includes(result.userId)||platformHandles.includes(result.username.toLowerCase()))throw new ConnectionError("Fluxknight's account cannot be attached to Limitless Realty.");
    const expiresAt=result.expiresIn?new Date(Date.now()+result.expiresIn*1000).toISOString():null;
    const admin=createAdminClient(),configuration=(integration?.configuration||{}) as Record<string,unknown>;
    const saved=await admin.rpc("store_organization_integration_credentials",{p_organization_id:organizationId,p_provider:"meta",p_display_name:"Meta",p_credentials:{...own,instagram_user_access_token:result.accessToken,instagram_login_user_id:result.userId,instagram_login_username:result.username,instagram_login_token_expires_at:expiresAt},p_configuration:{...configuration,instagram_login_connected_at:new Date().toISOString(),instagram_login_user_id:result.userId,instagram_login_username:result.username,instagram_login_account_type:result.accountType,instagram_login_token_expires_at:expiresAt,instagram_login_requested_permissions:[...INSTAGRAM_LOGIN_SCOPES],instagram_api_version:"v24.0"}});
    if(saved.error)throw new ConnectionError("The account could not be saved. Reconnect to retry.");
    const audit=await admin.from("audit_logs").insert({organization_id:organizationId,action:"social.real_estate.instagram_connected",resource_type:"organization_integration",resource_id:integration?.id||null,metadata:{actor_id:session.email,instagram_user_id:result.userId,username:result.username}});
    if(audit.error)throw new ConnectionError("Account saved, but audit recording failed. Check connection status before reconnecting.");
    target.searchParams.set("instagram","connected");
  }catch(error){
    // Provider/token exchange failures must not echo a code, token or secret.
    const message=error instanceof ConnectionError?error.message:"Instagram connection failed. Check the active workspace, account authorization and registered callback URI, then reconnect.";
    target.searchParams.set("error",message);
  }
  const response=NextResponse.redirect(target);response.cookies.set(realtyInstagramCookie(),"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});return response;
}
