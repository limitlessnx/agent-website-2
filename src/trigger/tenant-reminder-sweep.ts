import { schedules } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLatestRecurrence, resolveFixedDate, type RecurrenceFrequency } from "./tenant-reminder-calendar";

type ReminderRule = {
  id:string; organization_id:string; name:string; trigger_type:"date"|"recurring"|"event";
  event_key:string|null; anchor_field:string|null; schedule_config:Record<string,unknown>;
  audience_config:Record<string,unknown>; channel:"internal"|"whatsapp"|"email";
  status:string; starts_at:string|null; ends_at:string|null; timezone:string; created_at:string;
};
type Recipient={key:string;name:string;email:string|null;phone:string|null};
function validDate(value:unknown){if(typeof value!=="string"||!value)return null;const d=new Date(value);return Number.isFinite(d.getTime())?d:null;}
function localDate(date:Date,timezone:string){
 return new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function localNineUtc(date:string,timezone:string){
 const target=Date.parse(date+"T09:00:00Z");
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(target));
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 const represented=Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute),Number(values.second));
 return new Date(target+(target-represented));
}
function dueAt(rule:ReminderRule,now:Date):Date|null{
 if(rule.status!=="active")return null;
 const starts=validDate(rule.starts_at),ends=validDate(rule.ends_at);
 if(starts&&starts>now)return null;if(ends&&ends<now)return null;
 const config=rule.schedule_config||{};
 if(rule.trigger_type==="date")return resolveFixedDate(config.date,now);
 if(rule.trigger_type==="recurring"){
  const frequency=String(config.frequency||"") as RecurrenceFrequency;
  const anchor=starts||validDate(String(config.anchor_date||""))||validDate(rule.created_at);
  return anchor?getLatestRecurrence(anchor,now,frequency,Number(config.interval)||1):null;
 }
 return null;
}
async function contactsForRule(admin:any,rule:ReminderRule,now:Date):Promise<{recipients:Recipient[];scheduledFor:Date}|null>{
 if(rule.trigger_type!=="date"||!["birthday","anniversary"].includes(String(rule.anchor_field||"")))return null;
 const field=rule.anchor_field as "birthday"|"anniversary";
 const today=localDate(now,rule.timezone||"Africa/Lagos");
 const {data,error}=await admin.from("tenant_customer_contacts").select("id,full_name,email,phone,birthday,anniversary")
  .eq("organization_id",rule.organization_id).not(field,"is",null).limit(5000);
 if(error)throw error;
 const recipients:Recipient[]=(data||[]).filter((contact:any)=>{
  const value=String(contact[field]||"");
  return value.length>=10&&value.slice(5,10)===today.slice(5,10);
 }).map((contact:any)=>({key:contact.id,name:contact.full_name,email:contact.email,phone:contact.phone}));
 return {recipients,scheduledFor:localNineUtc(today,rule.timezone||"Africa/Lagos")};
}
export const tenantReminderSweep=schedules.task({
 id:"tenant-reminder-sweep",cron:{pattern:"*/15 * * * *",timezone:"Africa/Lagos"},
 run:async()=>{
  const admin=createAdminClient(),now=new Date();
  const {data:rules,error}=await admin.from("tenant_reminder_rules")
   .select("id,organization_id,name,trigger_type,event_key,anchor_field,schedule_config,audience_config,channel,status,starts_at,ends_at,timezone,created_at")
   .eq("status","active").limit(1000);
  if(error)throw error;
  let considered=0,queued=0,blocked=0,skipped=0;
  for(const rule of (rules||[]) as ReminderRule[]){
   considered++;
   const external=rule.channel!=="internal";
   const contactDate=await contactsForRule(admin,rule,now);
   let targets:Array<{recipient:Recipient;scheduledFor:Date}>=[];
   if(contactDate){
    targets=contactDate.recipients.map(recipient=>({recipient,scheduledFor:contactDate.scheduledFor}));
    if(!targets.length){skipped++;continue;}
   }else{
    const due=dueAt(rule,now);
    if(!due){skipped++;continue;}
    targets=[{recipient:{key:external?"delivery-pending":"tenant-internal",name:"",email:null,phone:null},scheduledFor:due}];
   }
   for(const target of targets){
    const scheduledFor=target.scheduledFor.toISOString();
    const {data:existing,error:lookupError}=await admin.from("tenant_reminder_executions").select("id")
      .eq("organization_id",rule.organization_id).eq("rule_id",rule.id).eq("recipient_key",target.recipient.key)
      .eq("scheduled_for",scheduledFor).limit(1).maybeSingle();
    if(lookupError)throw lookupError;if(existing){skipped++;continue;}
    const {error:insertError}=await admin.from("tenant_reminder_executions").insert({
     organization_id:rule.organization_id,rule_id:rule.id,recipient_key:target.recipient.key,
     scheduled_for:scheduledFor,channel:rule.channel,status:external?"blocked":"queued",
     last_error:external?"Consent-aware tenant contact delivery is not connected; no message was sent.":null,
     result:external?{reason:"delivery_adapter_not_ready",recipient_name:target.recipient.name||null}:{reason:"internal_execution_queued",recipient_name:target.recipient.name||null}
    });
    if(insertError){if(insertError.code==="23505"){skipped++;continue;}throw insertError;}
    if(external)blocked++;else queued++;
   }
  }
  return {considered,queued,blocked,skipped,at:now.toISOString()};
 }
});
