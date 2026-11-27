import { createAdminClient } from "@/lib/supabase/admin";
import { computeInitialFollowUpDueAt, resolveFollowUpPolicy } from "@/lib/follow-up-policy";
import { isExplicitLimitlessOptInMessage } from "@/lib/limitless-followup-contract";

const kind = "xposure_booking_follow_up";
const obj = (v: unknown) => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export async function syncXposureFollowup(input: {organizationId:string;agentId:string;customerId:string;conversationId:string;eventId:string;message:string;stopIntent:boolean}) {
  const admin = createAdminClient();
  const {data:org,error:orgError} = await admin.from("organizations").select("slug,status").eq("id",input.organizationId).maybeSingle();
  if(orgError) throw orgError;
  if(org?.slug !== "xposure" || org.status !== "active") return {skipped:"not_xposure"};
  const {data:customer,error:customerError} = await admin.from("crm_customers").select("id,phone,status,profile,metadata").eq("organization_id",input.organizationId).eq("id",input.customerId).maybeSingle();
  if(customerError) throw customerError;
  const {data:conversation,error:conversationError} = await admin.from("crm_conversations").select("id,status,metadata").eq("organization_id",input.organizationId).eq("id",input.conversationId).eq("customer_id",input.customerId).eq("agent_id",input.agentId).maybeSingle();
  if(conversationError) throw conversationError;
  if(!customer || !conversation) return {skipped:"missing_context"};
  const {error:cancelError} = await admin.from("crm_tasks").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("organization_id",input.organizationId).eq("customer_id",input.customerId).eq("task_type",kind).eq("status","scheduled");
  if(cancelError) throw cancelError;
  if(input.stopIntent || /\b(?:no thanks|not interested|cancel my booking)\b/i.test(input.message) || customer.status==="do_not_contact" || obj(customer.profile).opted_out || obj(customer.metadata).opted_out || obj(customer.metadata).do_not_contact) return {skipped:"opted_out_or_declined"};
  if(["waiting","human_active","resolved"].includes(conversation.status) || ["paused_for_handoff","human_takeover","stopped"].includes(String(obj(conversation.metadata).ai_response_mode))) return {skipped:"human_controlled"};
  if(!isExplicitLimitlessOptInMessage(input.message)) return {skipped:"explicit_consent_required"};
  const {data:bookings,error:bookingError} = await admin.from("xposure_bookings").select("id,service_type,requested_start_at,booking_status,payment_status,follow_up_state").eq("organization_id",input.organizationId).eq("conversation_id",input.conversationId).order("created_at",{ascending:false}).limit(1);
  if(bookingError) throw bookingError;
  const booking=bookings?.[0];
  // Do not guess a booking deadline from free text or revive an old booking.
  if(!booking?.requested_start_at || !["pending","awaiting_payment"].includes(booking.booking_status) || !["unpaid","rejected"].includes(booking.payment_status) || booking.follow_up_state==="paused") return {skipped:"verified_pending_booking_required"};
  const policy=await resolveFollowUpPolicy(input.organizationId,"xposure");
  const now=new Date();
  const due=computeInitialFollowUpDueAt(policy,now);
  if(Date.parse(due)>=Date.parse(booking.requested_start_at)) return {skipped:"booking_before_first_followup"};
  const {data:existing,error:existingError}=await admin.from("crm_tasks").select("id").eq("organization_id",input.organizationId).eq("customer_id",input.customerId).eq("task_type",kind).contains("metadata",{source_event_id:input.eventId}).limit(1).maybeSingle();
  if(existingError) throw existingError;
  if(existing) return {skipped:"already_recorded"};
  // Pending review until a dedicated delivery worker and its stop guards are verified.
  const {data,error}=await admin.from("crm_tasks").insert({organization_id:input.organizationId,customer_id:input.customerId,assigned_agent_id:input.agentId,task_type:kind,title:"Xposure booking follow-up",description:"Consent verified; pending delivery activation.",status:"pending",due_at:due,metadata:{conversation_id:input.conversationId,booking_id:booking.id,source_event_id:input.eventId,consent_at:now.toISOString(),consent_source:"customer_whatsapp",consent_actor:input.customerId,sequence:policy.sequence,booking_deadline:booking.requested_start_at,channel:"whatsapp",template_purpose:"customer_follow_up"}}).select("id").single();
  if(error) throw error;
  return {created:1,taskId:data.id,status:"pending_delivery_activation"};
}
