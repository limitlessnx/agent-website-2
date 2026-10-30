import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateEnrollment } from "@/lib/followup-control";

export async function POST(){
  const session=await getAdminSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({error:"Custom sequences and manual enrollment are not enabled for the Limitless Realty Maia runtime."},{status:410});
}

export async function PATCH(request:NextRequest){
  const session=await getAdminSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json();
    const required=["customer_id","sequence_id","step_id","reason"];
    if(!body.action||required.some((key)=>!Object.prototype.hasOwnProperty.call(body,key)||!String(body[key]||"").trim())) return NextResponse.json({error:"Exact customer, sequence, step, action, reason, and actor are required."},{status:400});
    if(!Object.prototype.hasOwnProperty.call(body,"property_id")) return NextResponse.json({error:"property_id must be supplied explicitly, including null for a sequence without a property."},{status:400});
    const admin=createAdminClient();
    const {data:organization,error:organizationError}=await admin.from("organizations").select("id").eq("slug","limitless-realty").maybeSingle();
    if(organizationError||!organization)return NextResponse.json({error:"Limitless Realty organization is not configured."},{status:500});
    const enrollment=await updateEnrollment({organizationId:organization.id,customerId:String(body.customer_id),propertyId:body.property_id===null?null:String(body.property_id),sequenceId:String(body.sequence_id),stepId:String(body.step_id),action:String(body.action),reason:String(body.reason),actor:`admin:${String(session.email||"authenticated-admin")}`,scheduledAt:body.scheduled_at?String(body.scheduled_at):undefined});
    if(!enrollment.length)return NextResponse.json({error:"Exact follow-up step was not found for Limitless Realty."},{status:404});
    return NextResponse.json({ok:true,enrollment:enrollment[0],exact_scope:{organization_id:organization.id,customer_id:body.customer_id,property_id:body.property_id,sequence_id:body.sequence_id,step_id:body.step_id}});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to update follow-up."},{status:400});}
}
