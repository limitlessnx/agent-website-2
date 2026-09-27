import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["integrations.manage","appointments.manage"]);}catch{
    return NextResponse.json({error:"Calendar management permission required"},{status:403});
  }
  const {id}=await params;
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  const admin=createAdminClient();
  const {data:resource,error}=await admin.from("appointment_calendar_resources")
    .select("*").eq("organization_id",session.organizationId).eq("id",id).maybeSingle();
  if(error) return NextResponse.json({error:error.message},{status:400});
  if(!resource) return NextResponse.json({error:"Calendar resource not found"},{status:404});

  const assignedMembershipId=Object.prototype.hasOwnProperty.call(body,"assignedMembershipId")
    ? (body.assignedMembershipId===null?null:String(body.assignedMembershipId||"").trim()||null)
    : resource.assigned_membership_id;
  const timezone=Object.prototype.hasOwnProperty.call(body,"timezone")
    ? String(body.timezone||"").trim()
    : resource.timezone;
  const duration=Object.prototype.hasOwnProperty.call(body,"defaultDurationMinutes")
    ? Number(body.defaultDurationMinutes)
    : resource.default_duration_minutes;
  const isDefault=Object.prototype.hasOwnProperty.call(body,"isDefault")
    ? body.isDefault===true
    : resource.is_default;
  const status=Object.prototype.hasOwnProperty.call(body,"status")
    ? String(body.status||"")
    : resource.status;
  const availability=Object.prototype.hasOwnProperty.call(body,"availabilityConfiguration")
    ? (body.availabilityConfiguration&&typeof body.availabilityConfiguration==="object"?body.availabilityConfiguration:{})
    : resource.availability_configuration;

  const {data:settings,error:settingsError}=await (admin as any).rpc("update_appointment_calendar_resource_settings",{
    p_organization_id:session.organizationId,
    p_resource_id:id,
    p_assigned_membership_id:assignedMembershipId,
    p_timezone:timezone,
    p_default_duration_minutes:duration,
    p_is_default:isDefault,
    p_status:status,
    p_availability_configuration:availability,
  });
  if(settingsError) return NextResponse.json({error:settingsError.message},{status:400});
  return NextResponse.json({ok:true,settings});
}
