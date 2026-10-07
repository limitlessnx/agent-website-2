import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxknightPlatformOrganizationId, canonicalizeEvaluationLead } from "@/lib/canonical-customer";
const clean=(v:unknown,max=500)=>typeof v==="string"?v.trim().slice(0,max):"";
export async function POST(req:NextRequest){try{
 const b=await req.json(); const sid=clean(b.sessionId,100); const e=b.evaluation||{}; const c=b.contact||{};
 const name=clean(c.name); const email=clean(c.email).toLowerCase(); const phone=clean(c.phone); const consent=c.consent===true;
 if(!sid||!name||!email.includes("@")||!phone||!consent) return NextResponse.json({error:"Contact details and explicit consent are required."},{status:400});
 const admin=createAdminClient(); const organizationId=await getFluxknightPlatformOrganizationId();
 const {data:session,error}=await admin.from("ai_business_evaluation_sessions").select("*").eq("id",sid).eq("organization_id",organizationId).single();
 if(error||!session||session.status!=="evaluated") return NextResponse.json({error:"Evaluation is not ready for approval."},{status:400});
 const evaluation=session.evaluation||e; const pricingType=evaluation.pricingType==="custom"?"custom":"standard"; const now=new Date().toISOString();
 const lead={organization_id:organizationId,name,email,phone,business_name:String(session.context?.businessName||"Business evaluation"),business_type:String(session.industry||session.context?.industry||"Other"),agent_types:Array.isArray(evaluation.recommendedAgents)?evaluation.recommendedAgents:[],main_goal:String(evaluation.summary||"AI business automation evaluation"),current_tools:null,lead_volume:"AI assessed",timeline:"AI assessed",budget:"Not provided",preferred_contact_time:null,consent_given:true,source:"website_ai_evaluation",status:pricingType==="custom"?"qualified":"new",submitted_at:now,evaluation_session_id:sid,ai_evaluation:evaluation,pricing_type:pricingType,approval_at:now};
 const {data:saved,error:leadError}=await admin.from("evaluation_leads").insert(lead).select("id").single(); if(leadError) throw leadError;
 const canonical=await canonicalizeEvaluationLead({evaluationId:String(saved.id),fullName:name,email,phone,companyName:lead.business_name});
 const {error:oppError}=await admin.from("evaluation_implementation_opportunities").insert({evaluation_lead_id:saved.id,customer_id:canonical.customerId,conversation_id:canonical.conversationId,title:lead.business_name+" · "+(pricingType==="custom"?"Custom implementation":"Standard onboarding"),pricing_type:pricingType,status:pricingType==="custom"?"contact_pending":"new",evaluation,contact_consent:true,contact_channels:["email","whatsapp"]});
 if(oppError) throw oppError;
 await admin.from("evaluation_leads").update({customer_id:canonical.customerId,conversation_id:canonical.conversationId}).eq("id",saved.id).eq("organization_id",organizationId);
 await admin.from("ai_business_evaluation_sessions").update({status:"approved",approved_at:now,updated_at:now}).eq("id",sid).eq("organization_id",organizationId);
 return NextResponse.json({success:true,pricingType,onboardingUrl:"/onboarding?evaluation="+encodeURIComponent(String(saved.id))});
}catch(error){console.error("[evaluation/approve]",error);return NextResponse.json({error:"Unable to save the approved evaluation."},{status:500})}}