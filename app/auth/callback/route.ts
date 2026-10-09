import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  clearClientOAuthContext,
  getClientAccountMode,
  getClientOAuthContext,
  getClientSession,
  getMembershipForOrganization,
  getPrimaryMembership,
  setClientSession,
  setManagerSession,
  setPendingClientSetupSession,
} from "@/lib/client-auth";
import { acceptOrganizationInvitation } from "@/lib/organization-membership";

function safeNext(value:string|null|undefined){
  return value&&value.startsWith("/")&&!value.startsWith("//")?value:"/portal";
}

function destination(origin:string,nextPath:string,txRef?:string,trialPlan?:string){
  const target=new URL(safeNext(nextPath),origin);
  if(txRef&&target.pathname==="/onboarding") target.searchParams.set("tx_ref",txRef);
  if(trialPlan==="basic") target.searchParams.set("trial","basic");
  return target;
}

export async function GET(request:NextRequest){
  const url=new URL(request.url);
  const code=url.searchParams.get("code");
  const origin=url.origin;

  if(!code){
    await clearClientOAuthContext().catch(()=>undefined);
    return NextResponse.redirect(new URL("/account/login?error=google_oauth",origin));
  }

  const context=await getClientOAuthContext();
  const nextPath=safeNext(context?.nextPath);
  const supabase=await createClient();
  const {data,error}=await supabase.auth.exchangeCodeForSession(code);

  if(error||!data.user){
    await clearClientOAuthContext().catch(()=>undefined);
    return NextResponse.redirect(new URL("/account/login?error=google_oauth",origin));
  }

  const email=String(data.user.email||"").trim().toLowerCase();
  if(!email){
    await supabase.auth.signOut();
    await clearClientOAuthContext().catch(()=>undefined);
    return NextResponse.redirect(new URL("/account/login?error=google_email",origin));
  }

  let membership:Awaited<ReturnType<typeof getPrimaryMembership>>=null;

  if(context?.invitationToken){
    try{
      const accepted=await acceptOrganizationInvitation({
        userId:data.user.id,
        email,
        token:context.invitationToken,
      });
      membership=await getMembershipForOrganization(data.user.id,accepted.organization_id);
    }catch{
      await setPendingClientSetupSession({
        userId:data.user.id,
        email,
        invitationToken:context.invitationToken,
        nextPath,
        txRef:context.txRef,
        trialPlan:context.trialPlan,
        issuedAt:Date.now(),
      });
      await clearClientOAuthContext().catch(()=>undefined);
      return NextResponse.redirect(new URL("/account/setup?error=invitation",origin));
    }
  }

  if(!membership){
    membership=await getPrimaryMembership(data.user.id);
  }

  if(membership){
    await setClientSession({
      userId:data.user.id,
      email,
      organizationId:membership.organizationId,
      organizationSlug:membership.organizationSlug,
      membershipId:membership.membershipId,
      role:membership.role,
      issuedAt:Date.now(),
    });

    // Do not hand the user a dashboard redirect until the Fluxknight
    // application session is actually readable and backed by a live membership.
    const clientSession=await getClientSession().catch(()=>null);
    if(!clientSession||clientSession.userId!==data.user.id||clientSession.membershipId!==membership.membershipId){
      await clearClientOAuthContext().catch(()=>undefined);
      return NextResponse.redirect(new URL("/account/login?error=google_session",origin));
    }

    await clearClientOAuthContext().catch(()=>undefined);
    return NextResponse.redirect(destination(origin,nextPath,context?.txRef,context?.trialPlan));
  }

  const accountMode=await getClientAccountMode(data.user.id);
  if(accountMode==="manager"){
    await setManagerSession({userId:data.user.id,email,issuedAt:Date.now()});
    await clearClientOAuthContext().catch(()=>undefined);
    return NextResponse.redirect(new URL("/manage-organizations",origin));
  }

  await setPendingClientSetupSession({
    userId:data.user.id,
    email,
    invitationToken:context?.invitationToken,
    nextPath:accountMode==="organization"?nextPath:"/account/choose-mode",
    txRef:context?.txRef,
    trialPlan:context?.trialPlan,
    issuedAt:Date.now(),
  });
  await clearClientOAuthContext().catch(()=>undefined);
  return NextResponse.redirect(new URL(accountMode==="organization"?"/account/setup":"/account/choose-mode?source=google&new_account=1",origin));
}
