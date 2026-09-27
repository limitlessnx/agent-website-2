import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getPrimaryMembership,
  setClientSession,
  setPendingClientSetupSession,
} from "@/lib/client-auth";

function safeNext(value:string|null){
  return value&&value.startsWith("/")&&!value.startsWith("//")?value:"/portal";
}

export async function GET(request:NextRequest){
  const url=new URL(request.url);
  const code=url.searchParams.get("code");
  const next=safeNext(url.searchParams.get("next"));
  const origin=url.origin;

  if(!code){
    return NextResponse.redirect(new URL("/account/login?error=google_oauth",origin));
  }

  const supabase=await createClient();
  const {data,error}=await supabase.auth.exchangeCodeForSession(code);
  if(error||!data.user){
    return NextResponse.redirect(new URL("/account/login?error=google_oauth",origin));
  }

  const email=String(data.user.email||"").trim().toLowerCase();
  if(!email){
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/account/login?error=google_email",origin));
  }

  const membership=await getPrimaryMembership(data.user.id);
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
    return NextResponse.redirect(new URL(next,origin));
  }

  await setPendingClientSetupSession({
    userId:data.user.id,
    email,
    issuedAt:Date.now(),
  });
  return NextResponse.redirect(new URL("/account/setup",origin));
}
