import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(){
 const session=await getClientSession();
 if(!session)return NextResponse.json({error:"Authentication required."},{status:401});
 try{await requirePortalPermission(session,["members.manage","members.view"]);
  const rows=await supabaseServerRequest<Array<{id:string;requester_user_id:string;status:string;created_at:string}>>(`organization_access_requests?organization_id=eq.${encodeURIComponent(session.organizationId)}&status=eq.pending&select=id,requester_user_id,status,created_at&order=created_at.asc`);
  const admin=createAdminClient();
  const requests=await Promise.all(rows.map(async row=>{const user=await admin.auth.admin.getUserById(row.requester_user_id);return {...row,email:user.data.user?.email||row.requester_user_id};}));
  return NextResponse.json({requests});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to load access requests."},{status:403});}
}

export async function POST(request:NextRequest){
 const session=await getClientSession();
 if(!session)return NextResponse.json({error:"Authentication required."},{status:401});
 try{
  await requirePortalPermission(session,["members.manage"]);
  const body=await request.json().catch(()=>({}));
  const requestId=String(body.request_id||"");
  const action=body.action==="approve"?"approve":body.action==="reject"?"reject":null;
  if(!requestId||!action)return NextResponse.json({error:"A request and action are required."},{status:400});
  const rpc=action==="approve"?"rpc/approve_organization_access_request":"rpc/reject_organization_access_request";
  const result=await supabaseServerRequest<Record<string,unknown>>(rpc,{method:"POST",body:JSON.stringify({p_request_id:requestId,p_actor_user_id:session.userId})});
  return NextResponse.json({ok:true,...result});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to update access request."},{status:403});}
}
