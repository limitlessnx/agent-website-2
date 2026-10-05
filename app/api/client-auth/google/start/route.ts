import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setClientOAuthContext } from "@/lib/client-auth";

function safeNext(value:string|null){
  return value&&value.startsWith("/")&&!value.startsWith("//")?value:"/portal";
}

export async function GET(request:NextRequest){
  const url=new URL(request.url);

  // Keep OAuth on one canonical production host so the signed OAuth-context
  // cookie survives the Google -> callback round trip. Preview deployments
  // intentionally keep their own host and are not redirected.
  if(url.hostname==="www.fluxknight.space"){
    const canonical=new URL(url.toString());
    canonical.hostname="fluxknight.space";
    return NextResponse.redirect(canonical);
  }
  const nextPath=safeNext(url.searchParams.get("next"));
  const txRef=String(url.searchParams.get("tx_ref")||"").trim().slice(0,240);
  const trialPlan=url.searchParams.get("trial")==="basic"?"basic":"";
  const invitationToken=String(url.searchParams.get("invitation_token")||url.searchParams.get("invite")||"").trim().slice(0,512);

  await setClientOAuthContext({
    nextPath,
    txRef:txRef||undefined,
    trialPlan,
    invitationToken:invitationToken||undefined,
    issuedAt:Date.now(),
  });

  const supabase=await createClient();
  const callback=new URL("/auth/callback",url.origin);
  const {data,error}=await supabase.auth.signInWithOAuth({
    provider:"google",
    options:{
      redirectTo:callback.toString(),
      scopes:"openid email profile",
    },
  });

  if(error||!data.url){
    return NextResponse.redirect(new URL("/account/login?error=google_oauth_start",url.origin));
  }
  return NextResponse.redirect(data.url);
}
