import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

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
  const optedOut=Boolean(lead.data.opted_out)||lead.data.status==="opted_out";
  const {data,error}=await current.admin.from("limitless_maia_followup_drafts").insert({
   organization_id:current.organizationId,lead_id:leadId,property_id:propertyId,reason,notes:notes||null,
   eligibility_snapshot:{system_recommendation:optedOut?"ineligible":"eligible_for_review",opted_out:optedOut,lead_status:lead.data.status||null,lead_score:lead.data.score||null},
   status:"draft",created_by:String(current.session.email||"authenticated-admin")
  }).select("*").single();
  if(error)throw error;return NextResponse.json({draft:data},{status:201});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save follow-up draft."},{status:400});}
}
export async function PATCH(request:NextRequest) {
 const current=await context();if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
 try {
  const body=await request.json(),id=String(body.id||"").trim(),action=String(body.action||"").trim();
  if(!id||!["approve","reject","cancel","confirm_consent","send"].includes(action))return NextResponse.json({error:"A draft and valid review action are required."},{status:400});
  const {data:existing,error:readError}=await current.admin.from("limitless_maia_followup_drafts")
   .select("id,lead_id,property_id,reason,notes,eligibility_snapshot,status").eq("id",id).eq("organization_id",current.organizationId).maybeSingle();
  if(readError)throw readError;
  if(!existing||existing.status!=="draft")return NextResponse.json({error:"This draft is no longer awaiting review."},{status:409});
  const now=new Date().toISOString(),actor=String(current.session.email||"authenticated-admin");
  if(action==="approve"&&body.consent_received!==true)return NextResponse.json({error:"Confirm that customer permission was genuinely received before approving this follow-up."},{status:400});
  const snapshot=existing.eligibility_snapshot&&typeof existing.eligibility_snapshot==="object"?existing.eligibility_snapshot:{};
  if(action==="confirm_consent"){
   if(typeof body.consent_received!=="boolean")return NextResponse.json({error:"Choose Yes or No for the consent confirmation."},{status:400});
   const {data:lead,error:leadError}=await current.admin.from("leads").select("opted_out,status").eq("id",existing.lead_id).eq("organization_id",current.organizationId).maybeSingle();
   if(leadError)throw leadError;
   if(!lead)return NextResponse.json({error:"The lead could not be verified in this organization."},{status:404});
   const optedOut=Boolean(lead.opted_out)||lead.status==="opted_out";
   if(body.consent_received&&optedOut)return NextResponse.json({error:"This lead is opted out. A new customer-initiated permission event must be recorded before follow-up can be considered."},{status:409});
   const eligibility_snapshot={...snapshot,consent_confirmation:{received:body.consent_received,confirmed_by:actor,confirmed_at:now,confirmation_method:"admin_attestation"},opted_out:optedOut};
   const {data,error}=await current.admin.from("limitless_maia_followup_drafts").update({
    eligibility_snapshot,reviewed_by:actor,reviewed_at:now,
    review_note:body.consent_received?"Admin confirmed that customer permission was received.":"Admin confirmed that permission was not received; draft remains inactive.",
    updated_at:now
   }).eq("id",id).eq("organization_id",current.organizationId).eq("status","draft").select("*").single();
   if(error)throw error;
   return NextResponse.json({draft:data,activated:false,note:body.consent_received?"Consent confirmation recorded. The draft still requires approval and the messaging workflow.":"No permission recorded. The draft remains inactive and no message was sent."});
  }
  if(action==="send"){
   const confirmation=snapshot.consent_confirmation as Record<string,unknown>|undefined;
   if(confirmation?.received!==true)return NextResponse.json({error:"Confirm that the customer genuinely gave permission before sending."},{status:409});
   const [lead,property]=await Promise.all([
    current.admin.from("leads").select("name,phone,opted_out,status,property_interest,purpose,location_preference").eq("id",existing.lead_id).eq("organization_id",current.organizationId).maybeSingle(),
    current.admin.from("properties").select("title,location").eq("id",existing.property_id).eq("organization_id",current.organizationId).maybeSingle()
   ]);
   if(lead.error)throw lead.error;if(property.error)throw property.error;
   if(!lead.data||!property.data)return NextResponse.json({error:"Lead or property could not be verified."},{status:404});
   if(Boolean(lead.data.opted_out)||lead.data.status==="opted_out")return NextResponse.json({error:"This lead has opted out. Sending is blocked."},{status:409});
   if(!lead.data.phone)return NextResponse.json({error:"This lead has no WhatsApp phone number."},{status:400});
   const {data:locked,error:lockError}=await current.admin.from("limitless_maia_followup_drafts").update({status:"sending",updated_at:now,delivery_error:null})
    .eq("id",id).eq("organization_id",current.organizationId).eq("status","draft").select("id").maybeSingle();
   if(lockError)throw lockError;
   if(!locked)return NextResponse.json({error:"This draft is already being processed."},{status:409});
   try{
    const result=await sendWhatsAppMessage({
     organizationId:current.organizationId,to:String(lead.data.phone),deliveryMode:"template",forceTemplate:true,
     templatePurpose:"follow_up_outside_24h",requestedTemplateName:"limitless_realty_reminder",recipientType:"customer",
     variables:{
      customer_name:String(lead.data.name||"there"),
      last_topic:String(existing.reason||existing.notes||"your property enquiry"),
      property_name:String(property.data.title||"the property"),
      property_location:String(property.data.location||lead.data.location_preference||"Not specified"),
      customer_interest:String(lead.data.property_interest||existing.reason||"Property enquiry"),
      customer_goal:String(lead.data.purpose||"Not specified"),
      objection:String(existing.notes||"None shared")
     }
    });
    const sentAt=new Date().toISOString();
    const {data:sent,error:sentError}=await current.admin.from("limitless_maia_followup_drafts").update({
     status:"sent",provider_message_id:result.providerMessageId||null,sent_at:sentAt,delivery_error:null,updated_at:sentAt,
     review_note:"Manual follow-up sent using the configured WhatsApp follow-up template."
    }).eq("id",id).eq("organization_id",current.organizationId).eq("status","sending").select("*").single();
    if(sentError)throw sentError;
    return NextResponse.json({draft:sent,sent:true,note:"Follow-up template accepted by WhatsApp. Maia's automated sequence was not changed."});
   }catch(sendError){
    const failedAt=new Date().toISOString(),safeError=sendError instanceof Error?sendError.message:"WhatsApp delivery failed.";
    await current.admin.from("limitless_maia_followup_drafts").update({status:"failed",delivery_error:safeError,updated_at:failedAt,review_note:"Manual follow-up delivery failed."}).eq("id",id).eq("organization_id",current.organizationId).eq("status","sending");
    return NextResponse.json({error:safeError,status:"failed"},{status:502});
   }
  }
  const status=action==="approve"?"approved":action==="reject"?"rejected":"cancelled";
  const {data,error}=await current.admin.from("limitless_maia_followup_drafts").update({
   status,reviewed_by:actor,reviewed_at:now,
   review_note:String(body.review_note||"").trim()||null,updated_at:now
  }).eq("id",id).eq("organization_id",current.organizationId).eq("status","draft").select("*").single();
  if(error)throw error;
  return NextResponse.json({draft:data,note:status==="approved"?"Draft approved. Approval does not itself send a WhatsApp message.":"Draft review saved."});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to review follow-up draft."},{status:400});}
}
