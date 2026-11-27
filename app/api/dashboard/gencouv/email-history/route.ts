import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError, gencouvPrivateHeaders, GENCOUV_UUID, GENCOUV_SENDERS, GencouvRequestError } from "@/lib/gencouv-admin";
import { resendApi } from "@/lib/fluxknight-mail";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const { db, organizationId } = await requireGencouvAdmin();
    const page = Math.floor(Math.max(0, Math.min(10000, Number(new URL(request.url).searchParams.get("page")) || 0)));
    const result = await db.from("gencouv_email_messages").select("id,recipient_email,subject,status,provider,provider_email_id,created_at,sent_at,delivered_at,error_message,send_batch_id,direction,from_email", { count: "exact" }).eq("organization_id", organizationId).eq("direction", "outbound").order("created_at", { ascending: false }).order("id").range(page * 50, page * 50 + 49);
    if (result.error) throw result.error;
    const batchIds=[...new Set((result.data||[]).flatMap(message=>message.send_batch_id?[message.send_batch_id]:[]))];
    const batches=batchIds.length?await db.from("gencouv_send_batches").select("id,status,error_summary").eq("organization_id",organizationId).in("id",batchIds):{data:[],error:null};
    if(batches.error)throw batches.error;
    const states=new Map((batches.data||[]).map(batch=>[batch.id,batch]));
    const messages=(result.data||[]).map(message=>{
      const batch=states.get(message.send_batch_id||"");
      const pending=message.status==="queued"&&batch&&["submitting","unknown","partial"].includes(batch.status);
      return{...message,status:pending?"unknown":message.status,submission_status:batch?.status||null,error_message:pending?(batch.error_summary||"Provider outcome is awaiting confirmation. Reconcile this batch without resending."):message.error_message};
    });
    return NextResponse.json({ messages, total: result.count, page }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
function email(value: unknown) { return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() || ""; }
function tag(value: unknown, name: string) {
  if (Array.isArray(value)) return value.find(item => item?.name === name)?.value;
  if (value && typeof value === "object") return (value as Record<string, unknown>)[name];
  return null;
}
export async function POST(request: Request) {
  try {
    const { db, organizationId, session } = await requireGencouvAdmin(request);
    const input = await request.json().catch(() => null);const batchId = String(input?.batch_id || "");
    if (!GENCOUV_UUID.test(batchId)) throw new GencouvRequestError("Choose a saved batch to reconcile.");
    const [batch, messages] = await Promise.all([
      db.from("gencouv_send_batches").select("id,status,from_email,subject,submitted_at").eq("organization_id", organizationId).eq("id", batchId).maybeSingle(),
      db.from("gencouv_email_messages").select("id,recipient_email,provider,provider_email_id,status").eq("organization_id", organizationId).eq("send_batch_id", batchId).order("created_at"),
    ]);
    if (batch.error || messages.error) throw new GencouvRequestError("Batch history is unavailable.", 503);
    if (!batch.data || !messages.data?.length) throw new GencouvRequestError("Batch not found.", 404);
    if (messages.data.some(message => message.provider === "brevo")) {
      if(messages.data.some(message=>message.provider!=="brevo"))throw new GencouvRequestError("Mixed provider batch cannot be reconciled.",409);
      const {readBrevoBatchEvents}=await import("@/lib/gencouv-brevo-reconcile");
      const events=await readBrevoBatchEvents(batchId,batch.data.from_email);
      const submittedAt=Date.parse(batch.data.submitted_at||"");
      let checked=0;
      for(const message of messages.data){
        const matches=events.filter(e=>e.email===message.recipient_email.toLowerCase()&&Date.parse(e.occurredAt)>=submittedAt-60000);
        const ids=[...new Set(matches.map(e=>e.providerId))];
        if(ids.length!==1||(message.provider_email_id&&message.provider_email_id!==ids[0]))continue;
        const bound=await db.rpc("gencouv_bind_brevo_receipt",{p_batch_id:batchId,p_message_id:message.id,p_email:message.recipient_email,p_provider_id:ids[0]});
        if(bound.error||bound.data!==true)throw new GencouvRequestError("Brevo receipt could not be recorded.",503);
        for(const event of matches.sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt))){
          const applied=await db.rpc("gencouv_apply_brevo_event",{p_event_id:event.eventId,p_type:event.type,p_provider_id:event.providerId,p_email:event.email,p_occurred_at:event.occurredAt});
          if(applied.error)throw new GencouvRequestError("Brevo event could not be recorded.",503);
        }
        checked++;
      }
      const unresolved=messages.data.length-checked;
      if(!unresolved){
        const updated=await db.from("gencouv_send_batches").update({status:"submitted",error_summary:null,updated_at:new Date().toISOString()}).eq("organization_id",organizationId).eq("id",batchId).in("status",["unknown","partial","submitting"]);
        if(updated.error)throw updated.error;
      }
      return NextResponse.json({checked,unresolved,note:"Brevo receipts refreshed. No email was resent."},{headers:gencouvPrivateHeaders});
    }
    const savedBatch = batch.data;
    let recent: Array<Record<string, unknown>> = [];
    if (messages.data.some(message => !message.provider_email_id) && ["unknown", "partial", "submitting"].includes(batch.data.status)) {
      const list = await resendApi("/emails?limit=100"); recent = Array.isArray(list.data) ? list.data : [];
    }
    let checked = 0;let unresolved = 0;
    for (const message of messages.data) {
      const candidates = message.provider_email_id ? [{ id: message.provider_email_id }] : recent.filter(item =>
        item.subject === savedBatch.subject && email(item.from) === savedBatch.from_email && Array.isArray(item.to) && item.to.some(to => email(to) === message.recipient_email)
        && new Date(String(item.created_at)).getTime() >= new Date(savedBatch.submitted_at || "").getTime() - 60000);
      let details: Record<string, unknown> | null = null;
      for (const candidate of candidates.slice(0, 5)) {
        if (!GENCOUV_UUID.test(String(candidate.id || ""))) continue;
        const detail = await resendApi("/emails/" + encodeURIComponent(String(candidate.id)));
        if (!GENCOUV_SENDERS.has(email(detail.from)) || !Array.isArray(detail.to) || !detail.to.some(to => email(to) === message.recipient_email)) continue;
        if (!message.provider_email_id && tag(detail.tags, "gencouv_message_id") !== message.id) continue;
        details = detail;break;
      }
      if (!details || !["sent", "delivered", "bounced", "complained", "failed", "opened", "clicked", "suppressed"].includes(String(details.last_event))) { unresolved++;continue; }
      const status = String(details.last_event);
      const applied = await db.rpc("gencouv_apply_delivery_event", { p_event_id: `reconcile:${details.id}:${status}`, p_type: `email.${status}`, p_data: { ...details, email_id: details.id, tags: { gencouv_message_id: message.id }, verification_source: "resend_api" }, p_occurred_at: new Date().toISOString() });
      if (applied.error) throw new GencouvRequestError("A provider result was read but could not be recorded. No email was resent.", 503);
      checked++;
    }
    if (!unresolved && checked === messages.data.length) {
      const updated = await db.from("gencouv_send_batches").update({ status: "submitted", error_summary: null, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", batchId).in("status", ["unknown", "partial", "submitting"]);
      if (updated.error) throw updated.error;
    }
    const audit = await db.from("audit_logs").insert({ organization_id: organizationId, action: "gencouv.email_batch_reconciled", resource_type: "gencouv_send_batch", resource_id: batchId, metadata: { actor_email: session.email, checked, unresolved, resent: false } });
    if (audit.error) throw audit.error;
    return NextResponse.json({ checked, unresolved, note: unresolved ? "Some provider outcomes remain unconfirmed. They stay held; no email was resent." : "Provider outcomes refreshed. No email was resent." }, { headers: gencouvPrivateHeaders });
  } catch (error) { const safe = gencouvError(error); return NextResponse.json({ error: safe.message }, { status: safe.status, headers: gencouvPrivateHeaders }); }
}
