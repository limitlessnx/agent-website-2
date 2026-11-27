import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders } from "@/lib/gencouv-admin";
import { isGencouvBrevoSender } from "@/lib/gencouv-brevo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const {db,organizationId}=await requireGencouvAdmin(request);
    const key = process.env.GENCOUV_BREVO_API_KEY;
    const configured = Boolean(key);
    let verifiedSenders: string[] = [];
    let reachable = false;
    let domainAuthenticated = false;
    if (key) {
      try {
        const response = await fetch("https://api.brevo.com/v3/senders", {
          headers: { "api-key": key, Accept: "application/json" },
          cache: "no-store", signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.senders)) {
            reachable = true;
            verifiedSenders = [...new Set<string>(data.senders.flatMap((sender: {email?: unknown; active?: unknown}) =>
              sender.active === true && isGencouvBrevoSender(sender.email) ? [sender.email.trim().toLowerCase()] : []))];
          }
        }
      } catch { /* Fail closed without returning provider payloads or secrets. */ }
    }
    if (key && reachable) {
      try {
        const response = await fetch("https://api.brevo.com/v3/domains/gencouv.com", {
          headers: { "api-key": key, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const domain = await response.json();
          domainAuthenticated = domain.authenticated === true;
        }
      } catch { /* Fail closed. */ }
    }
    const start=new Date();start.setUTCHours(0,0,0,0);
    const usage=await db.from("gencouv_send_batches").select("provider,recipient_count").eq("organization_id",organizationId).gte("created_at",start.toISOString()).not("status","in","(failed,cancelled)");
    const schemaReady=!usage.error;
    const activationEnabled=process.env.GENCOUV_BREVO_SENDING_ENABLED==="true";
    const deliveryVerified=process.env.GENCOUV_BREVO_DELIVERY_VERIFIED==="true" && (process.env.GENCOUV_BREVO_WEBHOOK_SECRET||"").length>=32;
    const used=schemaReady?(usage.data||[]).filter(row=>row.provider==="brevo").reduce((sum,row)=>sum+Number(row.recipient_count),0):null;
    const resendUsed=schemaReady?(usage.data||[]).filter(row=>row.provider==="resend").reduce((sum,row)=>sum+Number(row.recipient_count),0):null;
    const sendingAvailable=configured&&reachable&&domainAuthenticated&&verifiedSenders.length>0&&schemaReady&&activationEnabled&&deliveryVerified;
    return NextResponse.json({ configured, reachable, verifiedSenders, domainAuthenticated, schemaReady, activationEnabled, deliveryVerified, sendingAvailable,
      used,resendUsed,dailyLimit:300,remaining:used===null?null:Math.max(0,300-used),note:sendingAvailable?"Brevo manual sending enabled; account-wide credits may be lower.":"Brevo remains unavailable until all readiness gates pass." }, { headers: gencouvPrivateHeaders });
  } catch (error) {
    const safe = gencouvError(error);
    return NextResponse.json({ error: safe.message }, {status: safe.status, headers: gencouvPrivateHeaders});
  }
}
