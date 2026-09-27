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
  const timezone=String(body.timezone||"Africa/Lagos").trim();
  const availabilityConfiguration=body.availabilityConfiguration&&typeof body.availabilityConfiguration==="object"
    ? body.availabilityConfiguration
    : {};

  const admin=createAdminClient() as any;
  const {data,error}=await admin.rpc("set_appointment_availability_settings",{
    p_organization_id:session.organizationId,
    p_timezone:timezone,
    p_availability_configuration:availabilityConfiguration,
  });
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,settings:data});
}
