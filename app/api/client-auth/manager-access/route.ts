import { NextRequest, NextResponse } from "next/server";
import { getManagerSession, getPrimaryMembership } from "@/lib/client-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function GET(){
 const session=await getManagerSession();
 if(!session)return NextResponse.json({error:"Manager session required."},{status:401});
 const rows=await supabaseServerRequest<Array<{id:string;organization_id:string;status:string;created_at:string;organizations?:{name?:string}|Array<{name?:string}>}>>(`organization_access_requests?requester_user_id=eq.${encodeURIComponent(session.userId)}&select=id,organization_id,status,created_at,organizations(name)&order=created_at.desc`);
 return NextResponse.json({requests:rows.map(row=>({id:row.id,organization_id:row.organization_id,organization_name:Array.isArray(row.organizations)?row.organizations[0]?.name||"Organization":row.organizations?.name||"Organization",status:row.status,created_at:row.created_at}))});
}

export async function POST(request:NextRequest){
 const session=await getManagerSession();
 if(!session)return NextResponse.json({error:"Manager session required."},{status:401});
 const body=await request.json().catch(()=>({}));
 const code=String(body.access_code||"").trim();
 if(!code)return NextResponse.json({error:"Enter an Organization Access ID."},{status:400});
 try{
  const result=await supabaseServerRequest<Record<string,unknown>>("rpc/request_organization_access",{method:"POST",body:JSON.stringify({p_access_code:code,p_requester_user_id:session.userId})});
  return NextResponse.json({ok:true,...result});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to request access."},{status:400});}
}
