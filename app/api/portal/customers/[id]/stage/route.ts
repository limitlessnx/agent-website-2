import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["customers.manage"]);}catch{return NextResponse.json({error:"customers.manage required"},{status:403});}
  const {id}=await params;
  const body=await req.json().catch(()=>({})) as Record<string,unknown>;
  const stageId=String(body.stageId||"").trim();
  if(!stageId) return NextResponse.json({error:"stageId is required"},{status:400});
  const admin=createAdminClient() as any;
  const {data,error}=await admin.rpc("update_customer_stage",{
    p_organization_id:session.organizationId,
    p_customer_id:id,
    p_stage_id:stageId,
    p_changed_by_type:"human",
    p_changed_by_id:access.membershipId,
    p_reason:String(body.reason||"Stage updated from customer dashboard").trim(),
    p_source:"portal_customer",
    p_metadata:{},
  });
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,result:data});
}
