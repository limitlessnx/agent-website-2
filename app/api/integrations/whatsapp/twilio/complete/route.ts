import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { completeTwilioWhatsAppEmbeddedSignup } from "@/lib/twilio-whatsapp-onboarding";

export async function POST(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{
    return NextResponse.json({error:"integrations.manage required"},{status:403});
  }

  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  try{
    const result=await completeTwilioWhatsAppEmbeddedSignup({
      organizationId:session.organizationId,
      membershipId:session.membershipId,
      sessionId:String(body.sessionId||""),
      wabaId:String(body.wabaId||body.waba_id||""),
      metaPhoneNumberId:String(body.metaPhoneNumberId||body.phone_number_id||"").trim()||null,
      senderPhoneE164:String(body.senderPhoneE164||"").trim()||null,
      senderProfileName:String(body.senderProfileName||"").trim()||null,
    });
    return NextResponse.json({ok:true,...result});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to complete WhatsApp onboarding."},{status:400});
  }
}
