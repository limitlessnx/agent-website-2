import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

async function context() {
 const session=await getAdminSession(); if(!session)return null;
 const scope=await resolveAdminOrganizationScope();
 return {session,organizationId:scope.organizationId,admin:createAdminClient()};
}
export async function GET() {
 const current=await context(); if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
 try {
  const [properties,drafts]=await Promise.all([
   current.admin.from("properties").select("id,title").eq("organization_id",current.organizationId).order("title"),
   current.admin.from("limitless_maia_followup_drafts").select("*,leads(name,phone),properties(title)").eq("organization_id",current.organizationId).order("created_at",{ascending:false}).limit(200)
  ]);
  if(properties.error)throw properties.error;if(drafts.error)throw drafts.error;
  return NextResponse.json({properties:properties.data||[],drafts:drafts.data||[]},{headers:{"Cache-Control":"no-store"}});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load follow-up drafts."},{status:500});}
}
export async function POST(request:NextRequest) {
 const current=await context();if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
 try {
  const body=await request.json(),leadId=String(body.lead_id||"").trim(),propertyId=String(body.property_id||"").trim(),reason=String(body.reason||"").trim(),notes=String(body.notes||"").trim();
  if(!leadId||!propertyId||!reason)return NextResponse.json({error:"Lead, property, and follow-up reason are required."},{status:400});
  const [lead,property]=await Promise.all([
   current.admin.from("leads").select("id,opted_out,status,score").eq("id",leadId).eq("organization_id",current.organizationId).maybeSingle(),
   current.admin.from("properties").select("id,title").eq("id",propertyId).eq("organization_id",current.organizationId).maybeSingle()
  ]);
  if(lead.error)throw lead.error;if(property.error)throw property.error;
  if(!lead.data||!property.data)return NextResponse.json({error:"Lead or property was not found in this organization."},{status:404});
  const {data,error}=await current.admin.from("limitless_maia_followup_drafts").insert({
   organization_id:current.organizationId,lead_id:leadId,property_id:propertyId,reason,notes:notes||null,
   eligibility_snapshot:{system_recommendation:lead.data.opted_out?"ineligible":"review_required",opted_out:Boolean(lead.data.opted_out),lead_status:lead.data.status||null,lead_score:lead.data.score||null},
   status:"draft",created_by:String(current.session.email||"authenticated-admin")
  }).select("*").single();
  if(error)throw error;return NextResponse.json({draft:data},{status:201});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save follow-up draft."},{status:400});}
}
export async function PATCH(request:NextRequest) {
 const current=await context();if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
 try {
  const body=await request.json(),id=String(body.id||"").trim(),action=String(body.action||"").trim();
  if(!id||!["approve","reject","cancel"].includes(action))return NextResponse.json({error:"A draft and valid review action are required."},{status:400});
  const status=action==="approve"?"approved":action==="reject"?"rejected":"cancelled";
  const {data,error}=await current.admin.from("limitless_maia_followup_drafts").update({
   status,reviewed_by:String(current.session.email||"authenticated-admin"),reviewed_at:new Date().toISOString(),
   review_note:String(body.review_note||"").trim()||null,updated_at:new Date().toISOString()
  }).eq("id",id).eq("organization_id",current.organizationId).eq("status","draft").select("*").single();
  if(error)throw error;
  return NextResponse.json({draft:data,note:status==="approved"?"Draft approved. Messaging enrollment remains subject to explicit customer consent.":"Draft review saved."});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to review follow-up draft."},{status:400});}
}
