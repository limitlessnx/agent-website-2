import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canonicalizeEvaluationLead } from "@/lib/canonical-customer";

type EvaluationPayload = {
  name?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
  agentTypes?: string[];
  mainGoal?: string;
  currentTools?: string;
  leadVolume?: string;
  timeline?: string;
  budget?: string;
  preferredContactTime?: string;
  consent?: boolean;
};

const requiredStringFields: Array<keyof EvaluationPayload> = [
  "name","email","phone","businessName","businessType","mainGoal","leadVolume","timeline","budget",
];

function isValidEmail(email:string){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function sanitizeString(value:unknown){ return typeof value==="string" ? value.trim() : ""; }

export async function POST(req:NextRequest){
  try{
    const body=(await req.json()) as EvaluationPayload;
    const normalized:EvaluationPayload={
      name:sanitizeString(body.name),
      email:sanitizeString(body.email).toLowerCase(),
      phone:sanitizeString(body.phone),
      businessName:sanitizeString(body.businessName),
      businessType:sanitizeString(body.businessType),
      agentTypes:Array.isArray(body.agentTypes)?body.agentTypes.map(sanitizeString).filter(Boolean):[],
      mainGoal:sanitizeString(body.mainGoal),
      currentTools:sanitizeString(body.currentTools),
      leadVolume:sanitizeString(body.leadVolume),
      timeline:sanitizeString(body.timeline),
      budget:sanitizeString(body.budget),
      preferredContactTime:sanitizeString(body.preferredContactTime),
      consent:body.consent===true,
    };

    for(const field of requiredStringFields){
      if(!normalized[field]) return NextResponse.json({error:`${field} is required`},{status:400});
    }
    if(!isValidEmail(normalized.email||"")) return NextResponse.json({error:"Valid email is required"},{status:400});
    if(!normalized.consent) return NextResponse.json({error:"Consent is required before an AI evaluation call can be triggered"},{status:400});

    const now=new Date().toISOString();
    const lead={
      name:normalized.name!,
      email:normalized.email!,
      phone:normalized.phone!,
      business_name:normalized.businessName!,
      business_type:normalized.businessType!,
      agent_types:normalized.agentTypes||[],
      main_goal:normalized.mainGoal!,
      current_tools:normalized.currentTools||null,
      lead_volume:normalized.leadVolume!,
      timeline:normalized.timeline!,
      budget:normalized.budget!,
      preferred_contact_time:normalized.preferredContactTime||null,
      consent_given:true,
      source:"website_evaluation",
      status:"new",
      submitted_at:now,
    };

    const admin=createAdminClient();
    const {data:saved,error}=await admin.from("evaluation_leads").insert(lead).select("id").single();
    if(error) throw error;

    const canonical=await canonicalizeEvaluationLead({
      evaluationId:String(saved.id),
      fullName:lead.name,
      email:lead.email,
      phone:lead.phone,
      companyName:lead.business_name,
    });

    return NextResponse.json({
      success:true,
      evaluationId:String(saved.id),
      customerId:canonical.customerId,
      conversationId:canonical.conversationId,
      destinations:{supabase:true},
    });
  }catch(error){
    console.error("[Evaluation API Error]",error);
    return NextResponse.json({error:"Internal server error"},{status:500});
  }
}
