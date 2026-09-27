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

  const serviceKeys=Array.isArray(body.serviceKeys)
    ? body.serviceKeys.map((value)=>String(value||"").trim()).filter(Boolean)
    : (Array.isArray(resource.service_keys)?resource.service_keys:[]);
  const branchKey=Object.prototype.hasOwnProperty.call(body,"branchKey")
    ? String(body.branchKey||"").trim()||null
    : resource.branch_key;
  const departmentKey=Object.prototype.hasOwnProperty.call(body,"departmentKey")
    ? String(body.departmentKey||"").trim()||null
    : resource.department_key;
  const routingPriority=Object.prototype.hasOwnProperty.call(body,"routingPriority")
    ? Number(body.routingPriority)
    : Number(resource.routing_priority||100);

  const {data:scheduling,error:schedulingError}=await (admin as any).rpc("update_appointment_resource_scheduling_policy",{
    p_organization_id:session.organizationId,
    p_resource_id:id,
    p_availability_configuration:availability,
    p_service_keys:serviceKeys,
    p_branch_key:branchKey,
    p_department_key:departmentKey,
    p_routing_priority:routingPriority,
  });
  if(schedulingError) return NextResponse.json({error:schedulingError.message},{status:400});

  return NextResponse.json({ok:true,settings,scheduling});
}
