import { NextResponse } from "next/server";
import { normalizeBrevoEvent, verifyBrevoWebhook } from "@/lib/gencouv-brevo-events";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.GENCOUV_BREVO_WEBHOOK_SECRET) return NextResponse.json({error:"Webhook not configured"},{status:503});
  if (!verifyBrevoWebhook(request.headers.get("authorization")?.replace(/^Bearer /i,"") || null)) return NextResponse.json({error:"Unauthorized"},{status:401});
  try {
    const raw=await request.text();
    if(raw.length>100000) return NextResponse.json({error:"Payload too large"},{status:413});
    const event=normalizeBrevoEvent(JSON.parse(raw));
    if(!event) return NextResponse.json({ignored:true});
    const result=await supabaseServerRequest<{unmatched?:boolean}>("rpc/gencouv_apply_brevo_event",{method:"POST",body:JSON.stringify({
      p_event_id:event.eventId,p_type:event.type,p_provider_id:event.providerId,p_email:event.email,p_occurred_at:event.occurredAt
    })});
    if(result?.unmatched) return NextResponse.json({error:"Receipt not reconciled"},{status:503});
    return NextResponse.json({success:true});
  } catch { return NextResponse.json({error:"Event processing failed"},{status:503}); }
}
