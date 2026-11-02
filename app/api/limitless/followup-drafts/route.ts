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
  const [properties,drafts,template]=await Promise.all([
   current.admin.from("properties").select("id,title,type,location_city,location_area,price,bedrooms,bathrooms,size_sqm,status,features,description,estate_id").eq("organization_id",current.organizationId).order("title"),
   current.admin.from("limitless_maia_followup_drafts").select("*,leads(name,phone),properties(title)").eq("organization_id",current.organizationId).order("created_at",{ascending:false}).limit(200),
   current.admin.from("whatsapp_template_configs").select("template_name,status,metadata").eq("organization_id",current.organizationId).eq("purpose","follow_up_outside_24h").eq("template_name","limitless_realty_reminder").eq("status","active").limit(1).maybeSingle()
  ]);
  if(properties.error)throw properties.error;if(drafts.error)throw drafts.error;if(template.error)throw template.error;
  const approvedOrder=["customer_name","followup_context","property_details","next_step"];
  const templateMetadata=(template.data?.metadata||{}) as Record<string,unknown>;
  const templateReady=templateMetadata.provider_status==="approved"
   && Array.isArray(templateMetadata.approved_variable_order)
   && templateMetadata.approved_variable_order.length===approvedOrder.length
   && templateMetadata.approved_variable_order.every((key:unknown,index:number)=>key===approvedOrder[index]);
  const estateIds=[...new Set((properties.data||[]).map((property:any)=>property.estate_id).filter(Boolean))];
  const estates=estateIds.length
   ? await current.admin.from("real_estate_estates").select("id,name,location,address,status,payment_terms").eq("organization_id",current.organizationId).in("id",estateIds)
   : {data:[],error:null};
  if(estates.error)throw estates.error;
  const estateById=new Map((estates.data||[]).map((estate:any)=>[estate.id,estate]));
  const propertyOptions=(properties.data||[]).map((property:any)=>({...property,estate:property.estate_id?estateById.get(property.estate_id)||null:null}));
  return NextResponse.json({properties:propertyOptions,drafts:drafts.data||[],templateReady,templateStatus:templateMetadata.provider_status||"unverified"},{headers:{"Cache-Control":"no-store"}});
 } catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load follow-up drafts."},{status:500});}
}
export async function POST(request:NextRequest) {
 const current=await context();if(!current)return NextResponse.json({error:"Unauthorized"},{status:401});
 try {
  const body=await request.json(),leadId=String(body.lead_id||"").trim(),propertyId=String(body.property_id||"").trim(),reason=String(body.reason||"").trim(),notes=String(body.notes||"").trim(),messageContext=String(body.message_context||"").trim();
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
   eligibility_snapshot:{system_recommendation:optedOut?"ineligible":"eligible_for_review",opted_out:optedOut,lead_status:lead.data.status||null,lead_score:lead.data.score||null,message_context:messageContext||null},
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
    current.admin.from("leads").select("name,phone,opted_out,status,property_interest,purpose,location_preference,property_type,budget,timeline").eq("id",existing.lead_id).eq("organization_id",current.organizationId).maybeSingle(),
    current.admin.from("properties").select("id,title,type,location_city,location_area,price,bedrooms,bathrooms,size_sqm,status,features,description,estate_id").eq("id",existing.property_id).eq("organization_id",current.organizationId).maybeSingle()
   ]);
   if(lead.error)throw lead.error;if(property.error)throw property.error;
   if(!lead.data||!property.data)return NextResponse.json({error:"Lead or property could not be verified."},{status:404});
   if(Boolean(lead.data.opted_out)||lead.data.status==="opted_out")return NextResponse.json({error:"This lead has opted out. Sending is blocked."},{status:409});
   if(!lead.data.phone)return NextResponse.json({error:"This lead has no WhatsApp phone number."},{status:400});
   const estateResult=property.data.estate_id
    ? await current.admin.from("real_estate_estates").select("name,location,address,status,payment_terms").eq("id",property.data.estate_id).eq("organization_id",current.organizationId).maybeSingle()
    : {data:null,error:null};
   if(estateResult.error)throw estateResult.error;
   const clean=(value:unknown)=>String(value??"").replace(/\s+/g," ").trim();
   const propertyFacts=[
    clean(property.data.title),
    clean(property.data.type)?`Type: ${clean(property.data.type)}`:null,
    [clean(property.data.location_area),clean(property.data.location_city)].filter(Boolean).length
      ? `Location: ${[clean(property.data.location_area),clean(property.data.location_city)].filter(Boolean).join(", ")}`:null,
    property.data.price!==null&&property.data.price!==undefined
      ? `Listed price: ₦${Number(property.data.price).toLocaleString("en-NG")}`:null,
    property.data.size_sqm!==null&&property.data.size_sqm!==undefined
      ? `Size: ${Number(property.data.size_sqm).toLocaleString("en-NG")} sqm`:null,
    property.data.bedrooms!==null&&property.data.bedrooms!==undefined? `Bedrooms: ${property.data.bedrooms}`:null,
    property.data.bathrooms!==null&&property.data.bathrooms!==undefined? `Bathrooms: ${property.data.bathrooms}`:null,
    clean(property.data.status)?`Listing status: ${clean(property.data.status)}`:null,
    clean(property.data.features)?`Features/title: ${clean(property.data.features)}`:null,
    clean(property.data.description)?`Description: ${clean(property.data.description).slice(0,320)}`:null,
    clean(estateResult.data?.name)?`Estate: ${clean(estateResult.data?.name)}`:null,
    clean(estateResult.data?.location)?`Estate location: ${clean(estateResult.data?.location)}`:null,
    estateResult.data?.payment_terms? `Estate payment terms: ${JSON.stringify(estateResult.data.payment_terms)}`:null
   ].filter(Boolean);
   const propertyDetails=propertyFacts.join(" | ").slice(0,950);
   const enquiryContext=[clean(existing.reason),clean(snapshot.message_context),clean(lead.data.property_interest),clean(lead.data.purpose)]
    .filter(Boolean).join(" · ").slice(0,450);
   const followupContext=enquiryContext
    ? `I'm following up on your enquiry about ${enquiryContext}. Please let us know if you'd like any clarification.`
    : "I'm checking in on your property enquiry and would be happy to answer any questions.";
   const nextStep="Would you like more information about this property or help arranging the next step?";
   const {data:locked,error:lockError}=await current.admin.from("limitless_maia_followup_drafts").update({status:"sending",updated_at:now,delivery_error:null})
    .eq("id",id).eq("organization_id",current.organizationId).eq("status","draft").select("id").maybeSingle();
   if(lockError)throw lockError;
   if(!locked)return NextResponse.json({error:"This draft is already being processed."},{status:409});
   try{
    const result=await sendWhatsAppMessage({
     organizationId:current.organizationId,to:String(lead.data.phone),deliveryMode:"template",forceTemplate:true,
     templatePurpose:"follow_up_outside_24h",requestedTemplateName:"limitless_realty_reminder",recipientType:"customer",
     templateVariableOrder:["customer_name","followup_context","property_details","next_step"],
     strictTemplateContract:{approvedVariableOrder:["customer_name","followup_context","property_details","next_step"]},
     variables:{
      customer_name:String(lead.data.name||"there"),
      followup_context:followupContext,
      property_details:propertyDetails||clean(property.data.title)||"Property details available on request",
      next_step:nextStep
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
