import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage"]);}catch{
    return NextResponse.json({error:"integrations.manage required"},{status:403});
  }

  const admin=createAdminClient();
  const {data:integration,error}=await admin.from("organization_integrations")
    .select("id")
    .eq("organization_id",session.organizationId)
    .eq("provider","google_calendar")
    .maybeSingle();
  if(error) return NextResponse.json({error:error.message},{status:400});
  if(!integration) return NextResponse.json({ok:true});

  const {error:disconnectError}=await (admin as any).rpc("disconnect_organization_integration",{
    p_integration_id:integration.id,
    p_actor_email:session.email,
  });
  if(disconnectError) return NextResponse.json({error:disconnectError.message},{status:400});

  await admin.from("appointment_calendar_resources").update({
    status:"disabled",is_default:false,updated_at:new Date().toISOString(),
  }).eq("organization_id",session.organizationId).eq("integration_id",integration.id);

  return NextResponse.json({ok:true});
}
