import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders } from "@/lib/gencouv-admin";
import { isGencouvBrevoSender } from "@/lib/gencouv-brevo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireGencouvAdmin(request);
    const key = process.env.GENCOUV_BREVO_API_KEY;
    const configured = Boolean(key);
    let verifiedSenders: string[] = [];
    let reachable = false;
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
    return NextResponse.json({ configured, reachable, verifiedSenders, sendingAvailable: false,
      note: "Brevo delivery integration is pending. Resend remains the active provider." }, { headers: gencouvPrivateHeaders });
  } catch (error) {
    const safe = gencouvError(error);
    return NextResponse.json({ error: safe.message }, {status: safe.status, headers: gencouvPrivateHeaders});
  }
}
