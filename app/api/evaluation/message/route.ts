import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateRuntimeStructuredOutput } from "@/lib/ai-runtime/provider";
import { routeRuntimeModel } from "@/lib/ai-runtime/model-router";

const clean=(v:unknown,max=8000)=>typeof v==="string"?v.trim().slice(0,max):"";
const schema={type:"object",additionalProperties:false,properties:{
 reply:{type:"string"},ready:{type:"boolean"},
 evaluation:{type:"object",additionalProperties:false,properties:{
  opportunity:{type:"string",enum:["low","medium","high"]},score:{type:"number",minimum:0,maximum:100},
  categoryScores:{type:"object",additionalProperties:false,properties:{customerSupport:{type:"number",minimum:0,maximum:100},leadFollowUp:{type:"number",minimum:0,maximum:100},operations:{type:"number",minimum:0,maximum:100},marketing:{type:"number",minimum:0,maximum:100},automationReadiness:{type:"number",minimum:0,maximum:100}},required:["customerSupport","leadFollowUp","operations","marketing","automationReadiness"]},
  bottlenecks:{type:"array",items:{type:"string"}},recommendedAgents:{type:"array",items:{type:"string"}},channels:{type:"array",items:{type:"string"}},integrations:{type:"array",items:{type:"string"}},
  opportunities:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},description:{type:"string"},impact:{type:"string",enum:["high","medium"]},potential:{type:"number",minimum:0,maximum:100}},required:["title","description","impact","potential"]}},
  recommendedSystem:{type:"string"},estimatedAutomationPotential:{type:"string"},
  voiceAgent:{type:"string",enum:["recommended","optional","not_recommended"]},voiceReason:{type:"string"},
  recommendedPlan:{type:"string",enum:["basic","plus","business","business_plus"]},customReason:{type:["string","null"]},recommendationReason:{type:"string"},summary:{type:"string"},nextStep:{type:"string"}
 },required:["opportunity","score","categoryScores","bottlenecks","recommendedAgents","channels","integrations","opportunities","recommendedSystem","estimatedAutomationPotential","voiceAgent","voiceReason","recommendedPlan","customReason","recommendationReason","summary","nextStep"]}
}} as const;

function classify(e:any){
 const s=[...(e.recommendedAgents||[]),...(e.integrations||[]),...(e.bottlenecks||[]),String(e.customReason||"")].join(" ").toLowerCase();
 const requestedCustom=requirements?.specificity==="custom";\n const complex=requestedCustom||/(custom integration|multiple departments|multi[- ]channel|database|advanced workflow|erp|api|crm integration|complex|bespoke)/.test(s);
 return {...e,pricingType:complex?"custom":"standard",customReason:complex?e.customReason||"The workflow and integration scope goes beyond a standard plan.":null};
}

export async function POST(req:NextRequest){
 try{
  const b=await req.json(),sessionId=clean(b.sessionId,100),message=clean(b.message),contextPatch=b.contextPatch&&typeof b.contextPatch==="object"?b.contextPatch:null;
  if(!sessionId||!message)return NextResponse.json({error:"Session and message are required."},{status:400});
  const admin=createAdminClient(),{data:session,error}=await admin.from("ai_business_evaluation_sessions").select("*").eq("id",sessionId).single();
  if(error||!session)return NextResponse.json({error:"Evaluation session not found."},{status:404});
  const history=Array.isArray(session.messages)?session.messages.slice(-20):[],next=[...history,{role:"user",content:message}];
  const model=await routeRuntimeModel({identity:{scope:"public",channel:"chat"} as any});
  const ai=await generateRuntimeStructuredOutput({model,
   systemPrompt:"You are Maia, Fluxknight's senior business automation evaluator. The user has completed a structured business profile, operations assessment, and requirements statement describing what they want Fluxknight to do. Produce a grounded professional evaluation, not generic AI hype. Score the five categories based only on evidence in the submitted profile and operations. Identify exactly 3 highest-value automation opportunities. Recommend concrete agents and integrations. Recommend a voice agent when phone-based interaction, high enquiry volume, appointment booking or support makes it useful; otherwise mark it optional or not_recommended. Treat international voice deployment as feasible when appropriate, while noting that telephony availability and routing can vary by market. Do not use budget as the sole reason for custom pricing. Recommend exactly one best-fit standard plan when the needs fit Basic, Plus, Business or Business+. Only classify as custom when the workflow truly requires scope outside the standard plans. Explain the recommendation in one concise, specific paragraph tied to the business evidence. Do not ask for contact details. Return ready=true and the complete evaluation.",
   input:{context:session.context,messages:next},outputSchema:schema});
  const messages=[...next,{role:"assistant",content:String(ai.parsed?.reply||"Your evaluation is ready.")}];
  const mergedContext=contextPatch?{...(session.context||{}),...contextPatch}:session.context;
  let evaluation=null;
  if(ai.parsed?.ready===true&&ai.parsed?.evaluation){evaluation=classify(ai.parsed.evaluation,contextPatch?.requirements);await admin.from("ai_business_evaluation_sessions").update({status:"evaluated",messages,evaluation,context:mergedContext,updated_at:new Date().toISOString()}).eq("id",sessionId)}
  else await admin.from("ai_business_evaluation_sessions").update({messages,context:mergedContext,updated_at:new Date().toISOString()}).eq("id",sessionId);
  return NextResponse.json({messages,evaluation});
 }catch(error){console.error("[evaluation/message]",error);return NextResponse.json({error:"The AI evaluation could not be completed."},{status:500})}
}