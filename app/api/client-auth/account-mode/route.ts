import { NextRequest, NextResponse } from "next/server";
import { getPendingClientSetupSession, getClientAccountMode, setClientAccountMode, setManagerSession } from "@/lib/client-auth";

export async function POST(request:NextRequest){
  try{
    const pending=await getPendingClientSetupSession();
    if(!pending) return NextResponse.json({error:"Your account setup session has expired. Sign in again to continue."},{status:401});
    const body=await request.json().catch(()=>({}));
    const mode=body.account_mode==="manager"?"manager":body.account_mode==="organization"?"organization":null;
    if(!mode) return NextResponse.json({error:"Choose whether you are starting an organization or managing organizations."},{status:400});
    const existing=await getClientAccountMode(pending.userId);
    if(existing&&existing!==mode) return NextResponse.json({error:"Your account type has already been selected."},{status:409});
    await setClientAccountMode(pending.userId,mode);
    if(mode==="manager"){
      await setManagerSession({userId:pending.userId,email:pending.email,issuedAt:Date.now()});
      return NextResponse.json({ok:true,redirect_to:"/manage-organizations"});
    }
    return NextResponse.json({ok:true,redirect_to:"/account/setup"});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to save account type."},{status:400});
  }
}
