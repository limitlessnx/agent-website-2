import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { beginTwilioWhatsAppOnboarding } from "@/lib/twilio-whatsapp-onboarding";

export async function POST(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{
    return NextResponse.json({error:"integrations.manage required"},{status:403});
  }

  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const numberSource=String(body.numberSource||"customer") as "customer"|"twilio_sms"|"twilio_voice";
  if(!["customer","twilio_sms","twilio_voice"].includes(numberSource)){
    return NextResponse.json({error:"Invalid number source."},{status:400});
  }

  try{
    const result=await beginTwilioWhatsAppOnboarding({
      organizationId:session.organizationId,
      membershipId:session.membershipId,
      numberSource,
      senderPhoneE164:String(body.senderPhoneE164||"").trim()||null,
      senderProfileName:String(body.senderProfileName||"").trim()||null,
    });
    return NextResponse.json({ok:true,...result});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to start WhatsApp onboarding."},{status:400});
  }
}
