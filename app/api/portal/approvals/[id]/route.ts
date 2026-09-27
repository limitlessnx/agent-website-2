import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { decideOperationApproval } from "@/lib/human-operations";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const {id}=await params;
  try{
    const body=await req.json().catch(()=>({})) as Record<string,unknown>;
    const decision=String(body.decision||"");
    if(decision!=="approved"&&decision!=="rejected"){
      return NextResponse.json({error:"decision must be approved or rejected"},{status:400});
    }
    const result=await decideOperationApproval(session,id,decision,String(body.reason||""));
    return NextResponse.json({ok:true,result});
  }catch(error){
    const message=error instanceof Error?error.message:"Approval decision failed.";
    return NextResponse.json({error:message},{status:400});
  }
}
