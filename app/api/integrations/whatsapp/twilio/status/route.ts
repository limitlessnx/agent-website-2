import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { getTwilioWhatsAppBinding, refreshTwilioWhatsAppBinding } from "@/lib/twilio-whatsapp-onboarding";

export async function GET(){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.view","integrations.manage"]);}catch{
    return NextResponse.json({error:"Integration access required"},{status:403});
  }

  try{
    const existing=await getTwilioWhatsAppBinding(session.organizationId);
    if(!existing) return NextResponse.json({ok:true,status:"not_started",binding:null});
    const binding=["awaiting_sender_online","registering_sender","provisioning_subaccount"].includes(String(existing.status))
      ? await refreshTwilioWhatsAppBinding(session.organizationId)
      : existing;
    return NextResponse.json({ok:true,status:binding?.status||"not_started",binding});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to check WhatsApp onboarding status."},{status:400});
  }
}
