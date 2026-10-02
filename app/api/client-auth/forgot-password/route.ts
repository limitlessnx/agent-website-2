import { NextRequest, NextResponse } from "next/server";

function authConfig(){
  const url=(process.env.FLUXKNIGHT_SUPABASE_URL||process.env.LIMITLESS_SUPABASE_URL||process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||"").trim().replace(/\/$/,"");
  const anonKey=(process.env.FLUXKNIGHT_SUPABASE_ANON_KEY||process.env.LIMITLESS_SUPABASE_ANON_KEY||process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||"").trim();
  if(!url||!anonKey)throw new Error("Fluxknight authentication is not configured.");
  return{url,anonKey};
}

export async function POST(request:NextRequest){
  try{
    const body=await request.json().catch(()=>({}));
    const email=String(body.email||"").trim().toLowerCase();
    const next=String(body.next||"/portal");
    const safeNext=next.startsWith("/")&&!next.startsWith("//")?next:"/portal";
    if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"Enter a valid email address."},{status:400});
    const {url,anonKey}=authConfig();
    const response=await fetch(`${url}/auth/v1/recover`,{
      method:"POST",
      headers:{apikey:anonKey,Authorization:`Bearer ${anonKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({email,redirect_to:`${new URL(request.url).origin}/auth/recovery?next=${encodeURIComponent(safeNext)}`}),
      cache:"no-store",
    });
    if(!response.ok){
      const result=await response.json().catch(()=>({}));
      console.error("Fluxknight password recovery request failed",result);
    }
    return NextResponse.json({ok:true});
  }catch(error){
    console.error("Fluxknight password recovery configuration failed",error);
    return NextResponse.json({error:"Password recovery is temporarily unavailable."},{status:503});
  }
}
