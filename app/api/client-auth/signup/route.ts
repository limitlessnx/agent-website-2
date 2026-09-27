import { NextRequest, NextResponse } from "next/server";
import { provisionClientOrganization } from "@/lib/client-onboarding";
import { getMembershipForOrganization, getPrimaryMembership, setClientSession, setPendingClientSetupSession, signUpClient } from "@/lib/client-auth";
import { acceptOrganizationInvitation } from "@/lib/organization-membership";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function slugify(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)}
function firstName(value:string){return value.trim().split(/\s+/)[0]||"there"}

export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const fullName=String(body.full_name||"").trim(),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||"");
  const invitationToken=String(body.invitation_token||"").trim(),joiningOrganization=Boolean(invitationToken);
  const companyName=String(body.company_name||"").trim(),companySlug=slugify(String(body.company_slug||companyName));
  const templateSlug=String(body.template_slug||"").trim()||undefined,agentFamilyName=String(body.agent_family_name||companyName).trim();
  if(fullName.length<2)return NextResponse.json({error:"Full name is required."},{status:400});
  if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"A valid email is required."},{status:400});
  if(password.length<8)return NextResponse.json({error:"Password must contain at least 8 characters."},{status:400});
  if(!joiningOrganization&&companyName.length<2)return NextResponse.json({error:"Company name is required."},{status:400});
  if(!joiningOrganization&&!companySlug)return NextResponse.json({error:"A valid company slug is required."},{status:400});

  const auth=await signUpClient(email,password,fullName,{companyName:joiningOrganization?undefined:companyName,companySlug:joiningOrganization?undefined:companySlug,templateSlug:joiningOrganization?undefined:templateSlug,agentFamilyName:joiningOrganization?undefined:agentFamilyName});
  if(!auth.access_token){
   if(auth.user?.id)await setPendingClientSetupSession({userId:auth.user.id,email:auth.user.email||email,invitationToken:joiningOrganization?invitationToken:undefined,issuedAt:Date.now()});
   return NextResponse.json({ok:true,signed_in:false,account_mode:joiningOrganization?"organization-member":"organization-owner",requires_email_confirmation:true,message:"Account created. Verify your email, then sign in to continue."},{status:201});
  }
  if(!auth.user?.id)throw new Error("The account was authenticated, but the user profile could not be loaded.");

  let membership;let provisioned:unknown=null;
  if(joiningOrganization){const accepted=await acceptOrganizationInvitation({userId:auth.user.id,email:auth.user.email||email,token:invitationToken});membership=await getMembershipForOrganization(auth.user.id,accepted.organization_id)}
  else{provisioned=await provisionClientOrganization({userId:auth.user.id,organizationName:companyName,organizationSlug:companySlug,templateSlug,agentFamilyName});membership=await getPrimaryMembership(auth.user.id)}
  if(!membership)throw new Error("Organization membership could not be loaded.");

  await setClientSession({userId:auth.user.id,email:auth.user.email||email,organizationId:membership.organizationId,organizationSlug:membership.organizationSlug,membershipId:membership.membershipId,role:membership.role,issuedAt:Date.now()});
  await sendFluxknightLifecycleEvent({eventKey:`welcome:${auth.user.id}:${membership.organizationId}`,event:"fluxknight.user.verified",email:auth.user.email||email,userId:auth.user.id,organizationId:membership.organizationId,payload:{first_name:firstName(fullName),company_name:joiningOrganization?membership.organizationSlug:companyName,dashboard_url:fluxknightPortalUrl()}});
  return NextResponse.json({ok:true,signed_in:true,account_mode:joiningOrganization?"organization-member":"organization-owner",requires_email_confirmation:false,organization:provisioned,redirect_to:"/portal"},{status:201});
 }catch(error){const message=error instanceof Error?error.message:"Unable to create account.";const status=/already|duplicate|exists|registered|seat limit/i.test(message)?409:400;return NextResponse.json({error:message},{status})}
}
