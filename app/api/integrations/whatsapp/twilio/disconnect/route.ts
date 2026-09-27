import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteTwilioWhatsAppSender } from "@/lib/twilio-whatsapp";
import { getTwilioWhatsAppBinding } from "@/lib/twilio-whatsapp-onboarding";

export async function POST(){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{
    return NextResponse.json({error:"integrations.manage required"},{status:403});
  }

  const admin=createAdminClient();
  const binding=await getTwilioWhatsAppBinding(session.organizationId);
  if(!binding)return NextResponse.json({ok:true,disconnected:true});

  const {data:integration,error:integrationError}=await admin.from("organization_integrations")
    .select("id")
    .eq("organization_id",session.organizationId)
    .eq("provider","whatsapp")
    .maybeSingle();
  if(integrationError)return NextResponse.json({error:integrationError.message},{status:400});

  try{
    if(binding.twilio_sender_sid&&binding.twilio_subaccount_sid){
      const {data:credentials,error:credError}=await (admin as any).rpc("get_organization_integration_credentials",{
        p_organization_id:session.organizationId,
        p_provider:"whatsapp",
      });
      if(credError)throw credError;
      const raw=(credentials||{}) as Record<string,unknown>;
      const token=String(raw.twilio_auth_token||"");
      if(token){
        await deleteTwilioWhatsAppSender({
          accountSid:String(binding.twilio_subaccount_sid),
          authToken:token,
          senderSid:String(binding.twilio_sender_sid),
        });
      }
    }

    if(integration?.id){
      const {error}=await (admin as any).rpc("disconnect_organization_integration",{
        p_integration_id:integration.id,
        p_actor_email:session.email,
      });
      if(error)throw error;
    }

    await admin.from("whatsapp_twilio_bindings").update({
      status:"disconnected",
      twilio_sender_status:"OFFLINE",
      last_error_code:null,
      last_error_message:null,
      updated_at:new Date().toISOString(),
      last_checked_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId);

    return NextResponse.json({ok:true,disconnected:true});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to disconnect WhatsApp."},{status:400});
  }
}
