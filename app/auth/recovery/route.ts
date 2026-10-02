import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setPendingPasswordReset } from "@/lib/client-auth";

export async function GET(request:NextRequest){
  const url=new URL(request.url);
  const code=url.searchParams.get("code");
  if(!code)return NextResponse.redirect(new URL("/account/login?error=password_reset",url.origin));
  const supabase=await createClient();
  const {data,error}=await supabase.auth.exchangeCodeForSession(code);
  if(error||!data.session?.access_token){
    return NextResponse.redirect(new URL("/account/login?error=password_reset",url.origin));
  }
  await setPendingPasswordReset({
    accessToken:data.session.access_token,
    refreshToken:data.session.refresh_token,
    issuedAt:Date.now(),
  });
  return NextResponse.redirect(new URL("/account/reset-password",url.origin));
}
