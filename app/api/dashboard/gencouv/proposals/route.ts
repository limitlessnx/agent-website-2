import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { resendApi } from "@/lib/fluxknight-mail";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const senderAddresses = ["info@gencouv.com", "support@gencouv.com", "onboarding@gencouv.com"];
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
async function scope() {
  if (!(await getAdminSession())) return null;
  try { const result = await requireAdminSystemScope("gencouv"); return result.status !== "unavailable" ? result.organizationId : null; }
  catch { return null; }
}
const fail = (error: string, status = 400) => NextResponse.json({error},{status,headers});
export async function POST(request: NextRequest) {
  const org = await scope();
  if (!org) return fail("Gencouv admin workspace required.",403);
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("Invalid request origin.",403);
  const input = await request.json().catch(()=>null) as Record<string,unknown> | null;
  if (!input) return fail("Invalid message.");
  const sender = String(input.from || "").trim().toLowerCase();
  const recipient = String(input.to || "").trim().toLowerCase();
  const subject = String(input.subject || "").trim();
  const message = String(input.text || "").trim();
  if (!senderAddresses.includes(sender) || !emailPattern.test(recipient) || recipient.length>254 ||
      !subject || subject.length>200 || !message || message.length>30000) return fail("Valid Gencouv sender, one recipient, subject and message required.");
  if (input.confirmed !== true) return fail("Confirm this individual email before sending.");
  if (/\[[^\]\n]{1,80}\]/.test(subject+" "+message)) return fail("Replace proposal placeholders before sending.");
  const db = createAdminClient();
  // Sending is strictly one-to-one. Bulk marketing campaigns require a separate consent-gated send implementation.
  // A matching saved contact must not be unsubscribed, suppressed or blocked.
  const {data:matches,error:customerError} = await db.from("crm_customers")
    .select("id,status,metadata").eq("organization_id",org).ilike("email",recipient).limit(1);
  if (customerError) return fail("Recipient verification unavailable.",503);
  if (matches?.[0]?.status==="blocked" || matches?.[0]?.status==="archived") return fail("This contact is blocked.",403);
  const {data:stops,error:suppressError} = await db.from("gencouv_suppression_list")
    .select("id").eq("organization_id",org).eq("normalized_email",recipient).limit(1);
  if (suppressError) return fail("Suppression check unavailable.",503);
  if (stops?.length) return fail("Recipient is on the suppression list.",403);
  // This composer is for manually reviewed individual correspondence, never a campaign.
  try {
    const reply = await resendApi("/emails", {method:"POST",body:JSON.stringify({
      from:"Gencouv <"+sender+">",to:[recipient],subject,text:message,reply_to:sender
    })});
    const providerId = typeof reply.id === "string" ? reply.id : null;
    const {error:ledgerError} = await db.from("gencouv_email_messages").insert({
      organization_id:org,recipient_email:recipient,recipient_name:null,
      subject,status:"sent",provider:"resend",provider_email_id:providerId,
      sent_at:new Date().toISOString(),metadata:{source:"gencouv_manual_proposal",sender}
    });
    return NextResponse.json({
      ok:true,id:providerId,
      tracked:!ledgerError,
      note:ledgerError
        ? "Resend accepted the email, but Gencouv history could not be saved. Check provider ID before retrying."
        : "Resend accepted this individual email; inbox delivery is not yet confirmed."
    },{status:201,headers});
  } catch (error) {return fail(error instanceof Error?error.message:"Resend send failed.",502);}
}
