import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { updateEnrollment } from "@/lib/followup-control";

export async function POST(request:NextRequest){
  const session=await getAdminSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json({error:"Custom sequences and manual enrollment are not enabled for the Limitless Realty Maia runtime."},{status:410});
}

export async function PATCH(request:NextRequest){
  const session=await getAdminSession();
  if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const body=await request.json();
    const organizationId=String(body.organization_id||body.organizationId||"").trim();
    if(!organizationId||!body.id||!body.action)return NextResponse.json({error:"Organization, follow-up ID and action are required."},{status:400});
    const enrollment=await updateEnrollment(String(body.id),String(body.action),body.value?String(body.value):undefined,organizationId);
    return NextResponse.json({ok:true,enrollment:enrollment[0]||null});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to update follow-up."},{status:400});}
}
