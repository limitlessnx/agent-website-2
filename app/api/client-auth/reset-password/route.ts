import { NextRequest, NextResponse } from "next/server";
import { clearPendingPasswordReset, getPendingPasswordReset } from "@/lib/client-auth";

function authConfig(){
  const url=(process.env.FLUXKNIGHT_SUPABASE_URL||process.env.LIMITLESS_SUPABASE_URL||process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"").trim().replace(/\/$/,"");
  const anonKey=(process.env.FLUXKNIGHT_SUPABASE_ANON_KEY||process.env.LIMITLESS_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"").trim();
  if(!url||!anonKey)throw new Error("Fluxknight authentication is not configured.");
  return{url,anonKey};
}

export async function POST(request:NextRequest){
  try{
    const pending=await getPendingPasswordReset();
    if(!pending)return NextResponse.json({error:"This reset link has expired. Request a new one."},{status:401});
    const body=await request.json().catch(()=>({}));
    const password=String(body.password||"");
    const confirmation=String(body.password_confirmation||"");
    if(password.length<8)return NextResponse.json({error:"Password must contain at least 8 characters."},{status:400});
    if(password!==confirmation)return NextResponse.json({error:"Passwords do not match."},{status:400});
    const {url,anonKey}=authConfig();
    const response=await fetch(`${url}/auth/v1/user`,{
      method:"PUT",
      headers:{apikey:anonKey,Authorization:`Bearer ${pending.accessToken}`,"Content-Type":"application/json"},
      body:JSON.stringify({password}),
      cache:"no-store",
    });
    if(!response.ok){
      const result=await response.json().catch(()=>({}));
      return NextResponse.json({error:String(result.msg||result.error_description||"Unable to update your password.")},{status:400});
    }
    await clearPendingPasswordReset();
    return NextResponse.json({ok:true});
  }catch(error){
    console.error("Fluxknight password update failed",error);
    return NextResponse.json({error:"Password update is temporarily unavailable."},{status:503});
  }
}
