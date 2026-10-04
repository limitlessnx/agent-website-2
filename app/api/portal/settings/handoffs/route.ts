import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req:NextRequest){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["handoffs.manage"]);}catch{return NextResponse.json({error:"handoffs.manage required"},{status:403});}
  const body=await req.json().catch(()=>({})) as Record<string,unknown>;
  const action=String(body.action||"");
  const admin=createAdminClient();

  if(action==="save_member_preference"){
    const membershipId=String(body.membershipId||"").trim();
    if(!membershipId) return NextResponse.json({error:"membershipId is required"},{status:400});
    const {data:member}=await admin.from("organization_memberships").select("id").eq("organization_id",session.organizationId).eq("id",membershipId).eq("status","active").maybeSingle();
    if(!member) return NextResponse.json({error:"Member is not active in this organization"},{status:400});
    const phone=String(body.whatsappPhone||"").replace(/[^0-9+]/g,"").trim()||null;
    const supervisorName=String(body.supervisorName||"").trim().slice(0,160)||null;
    const isSupervisor=Boolean(body.isSupervisor);
    const {data:existingPref}=await admin.from("organization_member_notification_preferences").select("metadata").eq("organization_id",session.organizationId).eq("membership_id",membershipId).maybeSingle();
    const metadata={...((existingPref?.metadata||{}) as Record<string,unknown>),supervisor:isSupervisor,supervisor_name:supervisorName};
    const {data,error}=await admin.from("organization_member_notification_preferences").upsert({
      membership_id:membershipId,
      organization_id:session.organizationId,
      whatsapp_phone:phone,
      notify_whatsapp_handoffs:Boolean(body.notifyWhatsAppHandoffs),
      notify_dashboard_handoffs:true,
      metadata,
      updated_at:new Date().toISOString(),
    },{onConflict:"membership_id"}).select().single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true,result:data});
  }

  if(action==="save_rule"){
    const membershipId=String(body.membershipId||"").trim();
    const category=String(body.category||"").trim()||null;
    const name=String(body.name||category||"Default handoff rule").trim();
    if(!membershipId) return NextResponse.json({error:"membershipId is required"},{status:400});
    const {data:member}=await admin.from("organization_memberships").select("id").eq("organization_id",session.organizationId).eq("id",membershipId).eq("status","active").maybeSingle();
    if(!member) return NextResponse.json({error:"Member is not active in this organization"},{status:400});
    const {data:supervisorPref}=await admin.from("organization_member_notification_preferences").select("metadata").eq("organization_id",session.organizationId).eq("membership_id",membershipId).maybeSingle();
    if((supervisorPref?.metadata as Record<string,unknown>|null)?.supervisor!==true) return NextResponse.json({error:"Assignment target must be configured as a supervisor."},{status:400});
    const id=String(body.id||"").trim();
    const row={
      organization_id:session.organizationId,
      name,
      category,
      assigned_membership_id:membershipId,
      priority:Math.max(1,Math.min(1000,Number(body.priority||100))),
      notify_whatsapp:body.notifyWhatsApp!==false,
      notify_dashboard:true,
      status:"active",
      updated_at:new Date().toISOString(),
    };
    if(id){
      const {data,error}=await admin.from("handoff_assignment_rules").update(row).eq("organization_id",session.organizationId).eq("id",id).select().single();
      if(error) return NextResponse.json({error:error.message},{status:400});
      return NextResponse.json({ok:true,result:data});
    }
    const {data,error}=await admin.from("handoff_assignment_rules").insert(row).select().single();
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true,result:data});
  }

  if(action==="delete_rule"){
    const id=String(body.id||"").trim();
    if(!id) return NextResponse.json({error:"id is required"},{status:400});
    const {error}=await admin.from("handoff_assignment_rules").update({status:"inactive",updated_at:new Date().toISOString()})
      .eq("organization_id",session.organizationId).eq("id",id);
    if(error) return NextResponse.json({error:error.message},{status:400});
    return NextResponse.json({ok:true});
  }

  return NextResponse.json({error:"Unsupported action"},{status:400});
}
