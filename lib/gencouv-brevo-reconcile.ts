import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBrevoEvent } from "@/lib/gencouv-brevo-events";
export type BrevoBatchEvent = NonNullable<ReturnType<typeof normalizeBrevoEvent>>;
export async function readBrevoBatchEvents(batchId: string, sender: string, deadline?: AbortSignal): Promise<BrevoBatchEvent[]> {
  const key=process.env.GENCOUV_BREVO_API_KEY;
  if(!key) throw new Error("Brevo not configured");
  const tag="gencouv-"+batchId;
  const url=new URL("https://api.brevo.com/v3/smtp/statistics/events");
  url.searchParams.set("tags",JSON.stringify([tag]));
  url.searchParams.set("days","90");
  const pageSize = 250;
  url.searchParams.set("limit", String(pageSize));
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < 12; page++) {
    url.searchParams.set("offset", String(page * pageSize));
    const timeout = AbortSignal.timeout(8000);
    const response = await fetch(url, { headers: { "api-key": key, Accept: "application/json" },
      cache: "no-store", signal: deadline ? AbortSignal.any([deadline, timeout]) : timeout });
    if (!response.ok) throw new Error("Brevo event lookup unavailable");
    const data = await response.json();
    if (!Array.isArray(data.events) || data.events.length > pageSize) throw new Error("Invalid Brevo event report");
    rows.push(...data.events);
    if (data.events.length < pageSize) break;
    if (page === 11) throw new Error("Incomplete Brevo event report");
  }
  return rows.flatMap((row:Record<string,unknown>)=>{
    const reportedSender = String(row.from || "").trim();
    const address = reportedSender.match(/<([^<>]+)>$/)?.[1] ?? reportedSender;
    if (address.toLowerCase() !== sender.toLowerCase()) return [];
    let tags:unknown=row.tag;
    if(typeof tags==="string"&&tags.startsWith("[")){try{tags=JSON.parse(tags)}catch{return []}}
    if(tags!==tag&&!(Array.isArray(tags)&&tags.includes(tag)))return [];
    const event=normalizeBrevoEvent({event:row.event,email:row.email,"message-id":row.messageId,ts_event:Date.parse(String(row.date))/1000});
    return event?[event]:[];
  });
}

type BrevoBatch = { id: string; from_email: string; submitted_at: string | null };
type BrevoMessage = { id: string; recipient_email: string; provider_email_id: string | null; provider: string };

export async function reconcileBrevoBatch(db: SupabaseClient, organizationId: string, batch: BrevoBatch, messages: BrevoMessage[], deadline?: AbortSignal) {
  const submittedAt = Date.parse(batch.submitted_at ?? "");
  if (!Number.isFinite(submittedAt) || messages.some(message => message.provider !== "brevo")) {
    return { checked: 0, unresolved: messages.length };
  }
  const events = await readBrevoBatchEvents(batch.id, batch.from_email, deadline);
  let checked = 0;
  for (const message of messages) {
    deadline?.throwIfAborted();
    const matches = events.filter(event => event.email === message.recipient_email.toLowerCase() &&
      Date.parse(event.occurredAt) >= submittedAt - 60000);
    const ids = [...new Set(matches.map(event => event.providerId))];
    if (ids.length !== 1 || (message.provider_email_id && message.provider_email_id !== ids[0])) continue;
    const bound = await db.rpc("gencouv_bind_brevo_receipt", {
      p_batch_id: batch.id, p_message_id: message.id, p_email: message.recipient_email, p_provider_id: ids[0],
    });
    if (bound.error || bound.data !== true) throw new Error("Brevo receipt could not be recorded");
    for (const event of matches.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
      const applied = await db.rpc("gencouv_apply_brevo_event", {
        p_event_id: event.eventId, p_type: event.type, p_provider_id: event.providerId,
        p_email: event.email, p_occurred_at: event.occurredAt,
      });
      if (applied.error) throw new Error("Brevo event could not be recorded");
    }
    checked++;
  }
  const unresolved = messages.length - checked;
  if (!unresolved && messages.length) {
    const updated = await db.from("gencouv_send_batches").update({
      status: "submitted", error_summary: null, updated_at: new Date().toISOString(),
    }).eq("organization_id", organizationId).eq("id", batch.id).eq("provider", "brevo")
      .in("status", ["unknown", "partial", "submitting"]);
    if (updated.error) throw updated.error;
  }
  return { checked, unresolved };
}
