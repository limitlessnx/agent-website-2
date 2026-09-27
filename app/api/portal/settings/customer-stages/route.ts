import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

function slug(value:string){
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,80);
}

export async function POST(req:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["customers.manage"]);}catch{return NextResponse.json({error:"customers.manage required"},{status:403});}
  const body=await req.json().catch(()=>({})) as Record<string,unknown>;
  const action=String(body.action||"save");
  const admin=createAdminClient();

  if(action==="archive"){
    const id=String(body.id||"").trim();
    if(!id) return NextResponse.json({error:"id is required"},{status:400});
    const {error}=await admin.from("organization_customer_stages").update({status:"archived",updated_at:new Date().toISOString()})
      .eq("organization_id",session.organizationId).eq("id",id);
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true});
  }

  const name=String(body.name||"").trim();
  const key=slug(String(body.key||name));
  const category=String(body.category||"active");
  const allowed=["active","follow_up","won","lost","closed"];
  const position=Math.max(0,Math.min(1000,Number(body.position||0)));
  const followUpMinutes=body.followUpDefaultMinutes==null||body.followUpDefaultMinutes===""
    ? null
    : Math.max(5,Math.min(10080,Number(body.followUpDefaultMinutes)));
  if(!name||!key) return NextResponse.json({error:"Stage name is required"},{status:400});
  if(!allowed.includes(category)) return NextResponse.json({error:"Invalid stage category"},{status:400});

  const id=String(body.id||"").trim();
  if(id){
    const {data,error}=await admin.from("organization_customer_stages").update({
      name,key,category,position,is_terminal:Boolean(body.isTerminal),follow_up_default_minutes:followUpMinutes,
      status:"active",updated_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId).eq("id",id).select().single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true,result:data});
  }

  const {data,error}=await admin.from("organization_customer_stages").insert({
    organization_id:session.organizationId,key,name,category,position,is_terminal:Boolean(body.isTerminal),
    follow_up_default_minutes:followUpMinutes,status:"active",
  }).select().single();
  if(error) return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,result:data});
}
