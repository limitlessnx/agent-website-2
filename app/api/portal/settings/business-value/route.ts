import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

function nullableNumber(value:unknown){
  if(value==null||value==="") return null;
  const n=Number(value);
  return Number.isFinite(n)&&n>=0?n:null;
}

export async function POST(req:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["organization.manage"]);}catch{
    return NextResponse.json({error:"organization.manage required"},{status:403});
  }

  const body=await req.json().catch(()=>({})) as Record<string,unknown>;
  const enabled=body.enabled===true;
  const currency=String(body.currency||"").trim().toUpperCase()||null;
  const row={
    organization_id:session.organizationId,
    enabled,
    currency,
    human_hourly_value:nullableNumber(body.humanHourlyValue),
    minutes_per_ai_handled_conversation:nullableNumber(body.minutesPerAiHandledConversation),
    minutes_per_follow_up:nullableNumber(body.minutesPerFollowUp),
    minutes_per_appointment:nullableNumber(body.minutesPerAppointment),
    minutes_per_handoff_triage:nullableNumber(body.minutesPerHandoffTriage),
    updated_at:new Date().toISOString(),
  };
  const admin=createAdminClient();
  const {data,error}=await admin.from("organization_business_value_settings")
    .upsert(row,{onConflict:"organization_id"})
    .select()
    .single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,result:data});
}
