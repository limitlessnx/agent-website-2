import "server-only";
import { normalizeBrevoEvent } from "@/lib/gencouv-brevo-events";
export async function readBrevoBatchEvents(batchId: string, sender: string) {
  const key=process.env.GENCOUV_BREVO_API_KEY;
  if(!key) throw new Error("Brevo not configured");
  const tag="gencouv-"+batchId;
  const url=new URL("https://api.brevo.com/v3/smtp/statistics/events");
  url.searchParams.set("tags",JSON.stringify([tag]));
  url.searchParams.set("days","90");
  url.searchParams.set("limit","5000");
  const response=await fetch(url,{headers:{"api-key":key,Accept:"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error("Brevo event lookup unavailable");
  const data=await response.json();
  if(!Array.isArray(data.events)||data.events.length>=5000) throw new Error("Incomplete Brevo event report");
  return data.events.flatMap((row:Record<string,unknown>)=>{
    if(String(row.from||"").trim().toLowerCase()!==sender.toLowerCase()) return [];
    let tags:unknown=row.tag;
    if(typeof tags==="string"&&tags.startsWith("[")){try{tags=JSON.parse(tags)}catch{return []}}
    if(tags!==tag&&!(Array.isArray(tags)&&tags.includes(tag)))return [];
    const event=normalizeBrevoEvent({event:row.event,email:row.email,"message-id":row.messageId,ts_event:Date.parse(String(row.date))/1000});
    return event?[event]:[];
  });
}
