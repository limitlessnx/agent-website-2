import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getTwilioParentAccount } from "@/lib/twilio-whatsapp";

export const dynamic="force-dynamic";

export async function GET(){
  const session=await getAdminSession();
  if(!session) return NextResponse.json({error:"Unauthorized."},{status:401});

  try{
    const account=await getTwilioParentAccount();
    return NextResponse.json({
      ok:true,
      provider:"twilio",
      connected:true,
      account:{
        sid:account.sid,
        friendlyName:account.friendlyName,
        status:account.status,
        type:account.type,
      },
    });
  }catch(error){
    return NextResponse.json({
      ok:false,
      provider:"twilio",
      connected:false,
      error:error instanceof Error?error.message:"Unable to authenticate with the Twilio parent account.",
    },{status:502});
  }
}
