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
    if(!body.id||!body.action)return NextResponse.json({error:"Follow-up ID and action are required."},{status:400});
    const admin=createAdminClient();
    const {data:organization,error:organizationError}=await admin.from("organizations").select("id").eq("slug","limitless-realty").maybeSingle();
    if(organizationError||!organization)return NextResponse.json({error:"Limitless Realty organization is not configured."},{status:500});
    const enrollment=await updateEnrollment(String(body.id),String(body.action),body.value?String(body.value):undefined,organization.id);
    if(!enrollment.length)return NextResponse.json({error:"Follow-up not found for Limitless Realty."},{status:404});
    return NextResponse.json({ok:true,enrollment:enrollment[0]});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to update follow-up."},{status:400});}
}
