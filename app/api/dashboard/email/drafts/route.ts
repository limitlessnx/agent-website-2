import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdminOrganizationContext } from "@/lib/admin-organization-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFluxknightAddress } from "@/lib/fluxknight-mail";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
async function access() {
  const [session, organization] = await Promise.all([getAdminSession(), getAdminOrganizationContext()]);
  if (!session || organization.kind !== "system" || organization.id !== "fluxknight") return null;
  return session.email.trim().toLowerCase();
}
function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === request.nextUrl.origin);
}
function bad(message: string, status: number) {
  return NextResponse.json({error:message},{status,headers});
}
function fields(body: Record<string,unknown>) {
  const sender=String(body.sender || "").trim().toLowerCase();
  const recipient=String(body.recipient || "").trim();
  const subject=String(body.subject || "").trim();
  const text=String(body.body || "");
  const template=String(body.template || "blank").slice(0,40);
  if (!isFluxknightAddress(sender) || recipient.length>254 || subject.length>200 || text.length>30000) return null;
  return {sender,recipient,subject,body:text,template};
}
export async function GET() {
  const owner=await access();
  if (!owner) return bad("Fluxknight admin workspace required.",403);
  try {
    const {data,error}=await createAdminClient().from("fluxknight_email_drafts")
      .select("id,sender,recipient,subject,body,template,created_at,updated_at")
      .eq("owner_email",owner).order("updated_at",{ascending:false}).limit(100);
    if (error) throw error;
    return NextResponse.json({drafts:data||[]},{headers});
  } catch {return bad("Draft storage unavailable. Apply the email drafts migration.",503);}
}
export async function POST(request: NextRequest) {
  const owner=await access();
  if (!owner) return bad("Fluxknight admin workspace required.",403);
  if (!sameOrigin(request)) return bad("Invalid request origin.",403);
  const payload=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if (!payload) return bad("Invalid draft.",400);
  const draft=fields(payload);
  if (!draft) return bad("Invalid draft fields.",400);
  const id=typeof payload.id==="string" && /^[0-9a-f-]{36}$/i.test(payload.id)?payload.id:null;
  try {
    const db=createAdminClient();
    const query=id
      ? db.from("fluxknight_email_drafts").update({...draft,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_email",owner)
      : db.from("fluxknight_email_drafts").insert({...draft,owner_email:owner});
    const {data,error}=await query.select("id,sender,recipient,subject,body,template,created_at,updated_at").maybeSingle();
    if(error)throw error;
    if(!data)return bad("Draft not found.",404);
    return NextResponse.json({draft:data},{headers});
  } catch {return bad("Could not save draft.",503);}
}
export async function DELETE(request: NextRequest) {
  const owner=await access();
  if (!owner) return bad("Fluxknight admin workspace required.",403);
  if (!sameOrigin(request)) return bad("Invalid request origin.",403);
  const payload=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const id=typeof payload?.id==="string"?payload.id:"";
  if(!/^[0-9a-f-]{36}$/i.test(id))return bad("Invalid draft id.",400);
  try {
    const {error}=await createAdminClient().from("fluxknight_email_drafts").delete().eq("id",id).eq("owner_email",owner);
    if(error)throw error;
    return NextResponse.json({ok:true},{headers});
  } catch {return bad("Could not delete draft.",503);}
}
