import { NextRequest, NextResponse } from "next/server";
import { getMembershipForOrganization, setClientSession, setPendingClientSetupSession, signUpClient } from "@/lib/client-auth";
import { acceptOrganizationInvitation } from "@/lib/organization-membership";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function firstName(value:string){return value.trim().split(/\s+/)[0]||"there"}

export async function POST(request:NextRequest){
 try{
  const body=await request.json().catch(()=>({}));
  const fullName=String(body.full_name||"").trim(),email=String(body.email||"").trim().toLowerCase(),password=String(body.password||""),passwordConfirmation=String(body.password_confirmation||"");
  const invitationToken=String(body.invitation_token||"").trim(),joiningOrganization=Boolean(invitationToken);
  if(fullName.length<2)return NextResponse.json({error:"Full name is required."},{status:400});
  if(!/^\S+@\S+\.\S+$/.test(email))return NextResponse.json({error:"A valid email is required."},{status:400});
  if(password.length<8)return NextResponse.json({error:"Password must contain at least 8 characters."},{status:400});
  if(password!==passwordConfirmation)return NextResponse.json({error:"Passwords do not match."},{status:400});

  const auth=await signUpClient(email,password,fullName);
  if(!auth.access_token){
   if(auth.user?.id)await setPendingClientSetupSession({userId:auth.user.id,email:auth.user.email||email,invitationToken:joiningOrganization?invitationToken:undefined,nextPath:joiningOrganization?String(body.post_signup_path||"/portal"):"/portal",trialPlan:"",issuedAt:Date.now()});
   return NextResponse.json({ok:true,signed_in:false,account_mode:joiningOrganization?"organization-member":"organization-owner",requires_email_confirmation:true,message:"Account created. Verify your email, then sign in to continue."},{status:201});
  }
  if(!auth.user?.id)throw new Error("The account was authenticated, but the user profile could not be loaded.");

  if(joiningOrganization){
    const accepted=await acceptOrganizationInvitation({userId:auth.user.id,email:auth.user.email||email,token:invitationToken});
    const membership=await getMembershipForOrganization(auth.user.id,accepted.organization_id);
    if(!membership)throw new Error("Organization membership could not be loaded.");
    await setClientSession({userId:auth.user.id,email:auth.user.email||email,organizationId:membership.organizationId,organizationSlug:membership.organizationSlug,membershipId:membership.membershipId,role:membership.role,issuedAt:Date.now()});
    await sendFluxknightLifecycleEvent({eventKey:`welcome:${auth.user.id}:${membership.organizationId}`,event:"fluxknight.user.verified",email:auth.user.email||email,userId:auth.user.id,organizationId:membership.organizationId,payload:{first_name:firstName(fullName),company_name:membership.organizationSlug,dashboard_url:fluxknightPortalUrl()}});
    return NextResponse.json({ok:true,signed_in:true,account_mode:"organization-member",requires_email_confirmation:false,redirect_to:String(body.post_signup_path||"/portal")},{status:201});
  }

  await setPendingClientSetupSession({
    userId:auth.user.id,
    email:auth.user.email||email,
    nextPath:"/portal",
    trialPlan:"",
    issuedAt:Date.now(),
  });
  return NextResponse.json({ok:true,signed_in:true,account_mode:"organization-owner",requires_email_confirmation:false,requires_workspace_setup:true,redirect_to:"/account/setup"},{status:201});
 }catch(error){const message=error instanceof Error?error.message:"Unable to create account.";const status=/already|duplicate|exists|registered|seat limit/i.test(message)?409:400;return NextResponse.json({error:message},{status})}
}
