import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["appointments.manage","integrations.manage"]);}catch{
    return NextResponse.json({error:"appointments.manage or integrations.manage required"},{status:403});
  }

  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const strategy=String(body.strategy||"default");
  const fallbackToDefault=body.fallbackToDefault!==false;
  const lookaheadDays=Math.max(1,Math.min(365,Number(body.lookaheadDays)||30));

  const admin=createAdminClient() as any;
  const {data,error}=await admin.rpc("set_appointment_routing_settings",{
    p_organization_id:session.organizationId,
    p_strategy:strategy,
    p_fallback_to_default:fallbackToDefault,
    p_lookahead_days:lookaheadDays,
    p_metadata:{updated_from:"tenant_integration_centre"},
  });
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,settings:data});
}
