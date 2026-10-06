import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientSession } from "@/lib/client-auth";

export async function POST(req:NextRequest){
  try{
    const session=await getClientSession();
    if(!session) return NextResponse.json({saved:false,error:"Sign in to save this evaluation to your dashboard."},{status:401});
    const body=await req.json().catch(()=>({}));
    const sessionId=String(body.sessionId||"").trim();
    if(!sessionId) return NextResponse.json({error:"Evaluation session is required."},{status:400});
    const admin=createAdminClient();
    const {data:evaluation,error}=await admin.from("ai_business_evaluation_sessions").select("id,status,organization_id,user_id").eq("id",sessionId).single();
    if(error||!evaluation) return NextResponse.json({error:"Evaluation session not found."},{status:404});
    if(evaluation.organization_id && evaluation.organization_id!==session.organizationId) return NextResponse.json({error:"This evaluation belongs to another workspace."},{status:403});
    const {error:updateError}=await admin.from("ai_business_evaluation_sessions").update({organization_id:session.organizationId,user_id:session.userId,updated_at:new Date().toISOString()}).eq("id",sessionId);
    if(updateError) throw updateError;
    return NextResponse.json({saved:true,organizationId:session.organizationId});
  }catch(error){console.error("[evaluation/claim]",error);return NextResponse.json({error:"Unable to save the evaluation to your dashboard."},{status:500})}
}
