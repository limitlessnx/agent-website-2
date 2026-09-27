import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { assignHumanHandoff, claimHumanHandoff, resolveHumanHandoff } from "@/lib/human-operations";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;
    const action=String(body.action||"");
    if(action==="claim") return NextResponse.json({ok:true,result:await claimHumanHandoff(session,id)});
    if(action==="assign") {
      const membershipId=String(body.membershipId||"").trim();
      if(!membershipId) return NextResponse.json({error:"membershipId is required"},{status:400});
      return NextResponse.json({ok:true,result:await assignHumanHandoff(session,id,membershipId)});
    }
    if(action==="resolve"){
      return NextResponse.json({ok:true,result:await resolveHumanHandoff(
        session,id,String(body.resolution||""),body.resumeAi!==false,{
          outcome:String(body.outcome||"").trim()||null,
          nextAction:String(body.nextAction||"").trim()||null,
          stageId:String(body.stageId||"").trim()||null,
          followUpRequired:body.followUpRequired!==false,
          followUpMinutes:Number(body.followUpMinutes||720),
        },
      )});
    }
    return NextResponse.json({error:"Unsupported handoff action"},{status:400});
  }catch(error){
    const message=error instanceof Error?error.message:"Handoff action failed.";
    return NextResponse.json({error:message},{status:400});
  }
}
