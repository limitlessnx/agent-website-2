import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { listOrganizationMembers } from "@/lib/organization-membership";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(){
  const session=await getClientSession();
  if(!session)return NextResponse.json({error:"Authentication required."},{status:401});
  try{
    await requirePortalPermission(session,["members.manage","members.view"]);
    const [rows,members]=await Promise.all([
      supabaseServerRequest<Array<{id:string;requester_user_id:string;status:string;created_at:string}>>(
        `organization_access_requests?organization_id=eq.${encodeURIComponent(session.organizationId)}&status=eq.pending&select=id,requester_user_id,status,created_at&order=created_at.asc`
      ),
      listOrganizationMembers(session.organizationId,session.userId),
    ]);
    const admin=createAdminClient();
    const requests=await Promise.all(rows.map(async row=>{
      const user=await admin.auth.admin.getUserById(row.requester_user_id);
      return {...row,email:user.data.user?.email||row.requester_user_id};
    }));
    return NextResponse.json({requests,members});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to load team access."},{status:403});
  }
}

export async function POST(request:NextRequest){
  const session=await getClientSession();
  if(!session)return NextResponse.json({error:"Authentication required."},{status:401});
  try{
    await requirePortalPermission(session,["members.manage"]);
    const body=await request.json().catch(()=>({}));
    const action=body.action;
    if(action==="approve"||action==="reject"){
      const requestId=String(body.request_id||"");
      if(!requestId)return NextResponse.json({error:"A request is required."},{status:400});
      const rpc=action==="approve"?"rpc/approve_organization_access_request":"rpc/reject_organization_access_request";
      const result=await supabaseServerRequest<Record<string,unknown>>(rpc,{
        method:"POST",
        body:JSON.stringify({p_request_id:requestId,p_actor_user_id:session.userId}),
      });
      return NextResponse.json({ok:true,...result});
    }
    if(action==="remove"){
      const membershipId=String(body.membership_id||"");
      if(!membershipId)return NextResponse.json({error:"A manager membership is required."},{status:400});
      const members=await listOrganizationMembers(session.organizationId,session.userId);
      const target=members.find(member=>member.id===membershipId);
      if(!target)return NextResponse.json({error:"Manager membership not found."},{status:404});
      if(target.role!=="manager")return NextResponse.json({error:"Only manager memberships can be removed here."},{status:400});
      const result=await supabaseServerRequest<Record<string,unknown>>("rpc/update_organization_member_access",{
        method:"POST",
        body:JSON.stringify({
          p_organization_id:session.organizationId,
          p_actor_user_id:session.userId,
          p_membership_id:membershipId,
          p_role_slug:null,
          p_status:"removed",
        }),
      });
      return NextResponse.json({ok:true,...result});
    }
    return NextResponse.json({error:"Unsupported team access action."},{status:400});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Unable to update team access."},{status:403});
  }
}
