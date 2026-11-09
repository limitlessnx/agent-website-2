import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { createAdminClient } from "@/lib/supabase/admin";
import { HotelWorkspaceError } from "@/lib/hotel-booking-service";
import { isCalendarDate,stayNights } from "@/lib/hotel-booking-contract";
import { hotelLocalDay,hotelNextDay,type HotelOverviewCore,type HotelOverviewData } from "@/lib/hotel-overview-contract";
import { loadHotelOverviewDetails } from "@/lib/hotel-overview-details";
export async function hotelOverviewAccess(){
  const session=await getClientSession();if(!session)throw new HotelWorkspaceError("Sign in to this workspace.",401);
  try {const access=session.isAdminPreview?{permissions:new Set(["customers.view","billing.view","conversations.view","handoffs.view"])}:await requirePortalPermission(session,["customers.view","customers.manage"]);await requireHotelOrganization(session.organizationId);return {session,permissions:access.permissions};}
  catch {throw new HotelWorkspaceError("Hotel overview access required.",403);}
}
function check(error:unknown){if(error)throw new HotelWorkspaceError("Hotel overview data could not be loaded. Try refreshing.",503);}
export async function loadHotelOverview(org:string,permissions:Set<string>,preview:boolean,range?:{arrival:string;departure:string;guests:number},now=new Date()):Promise<HotelOverviewData>{
  const admin=createAdminClient();const profile=await admin.from("client_onboarding_profiles").select("timezone").eq("organization_id",org).maybeSingle();check(profile.error);
  const calendar=hotelLocalDay(profile.data?.timezone,now),selected=range||{arrival:calendar.day,departure:hotelNextDay(calendar.day),guests:2};
  if(!isCalendarDate(selected.arrival)||!isCalendarDate(selected.departure)||stayNights(selected.arrival,selected.departure)<1||stayNights(selected.arrival,selected.departure)>365||!Number.isInteger(selected.guests)||selected.guests<1||selected.guests>20)throw new HotelWorkspaceError("Choose a stay of 1–365 nights and 1–20 guests.");
  const canViewPayments=permissions.has("billing.view")||permissions.has("billing.manage"),canViewConversations=permissions.has("conversations.view")||permissions.has("conversations.reply"),canViewHandoffs=permissions.has("handoffs.view")||permissions.has("handoffs.manage");
  const [core,payments,handoffs,conversations]=await Promise.all([
    admin.rpc("hotel_overview_core",{p_organization_id:org,p_day:calendar.day,p_arrival:selected.arrival,p_departure:selected.departure,p_guests:selected.guests}),
    canViewPayments?admin.from("hotel_offline_payments").select("id,booking_id",{count:"exact"}).eq("organization_id",org).eq("status","pending").order("created_at").limit(3):Promise.resolve({data:[],count:null,error:null}),
    canViewHandoffs?admin.from("human_handoffs").select("id",{count:"exact",head:true}).eq("organization_id",org).not("status","in","(resolved,closed)"):Promise.resolve({count:null,error:null}),
    canViewConversations?admin.from("crm_conversations").select("id,customer_id,channel,status,updated_at").eq("organization_id",org).not("status","in","(resolved,closed)").order("updated_at",{ascending:false}).limit(3):Promise.resolve({data:null,error:null}),
  ]);
  for(const result of [core,payments,handoffs,conversations])check(result.error);
  if(!core.data)throw new HotelWorkspaceError("Hotel summary is unavailable.",503);
  const previews=conversations.data===null?null:await Promise.all((conversations.data||[]).map(async conversation=>{
    const [customer,message]=await Promise.all([
      admin.from("crm_customers").select("full_name").eq("organization_id",org).eq("id",conversation.customer_id).maybeSingle(),
      admin.from("crm_messages").select("content").eq("organization_id",org).eq("conversation_id",conversation.id).in("direction",["inbound","outbound"]).order("created_at",{ascending:false}).limit(1).maybeSingle(),
    ]);check(customer.error);check(message.error);
    return {id:String(conversation.id),guest_name:customer.data?.full_name||"Guest",channel:String(conversation.channel||"conversation"),status:String(conversation.status||"open"),updated_at:String(conversation.updated_at),preview:String(message.data?.content||"No message preview available.").slice(0,180)};
  }));
  const summary=core.data as HotelOverviewCore;
  // A photo/details failure must not erase the authoritative operational summary.
  const details=await loadHotelOverviewDetails(org,summary.availability.slice(0,6).map(type=>type.id)).catch(()=>null);
  return {...summary,...calendar,checkedAt:now.toISOString(),range:selected,pendingPayments:payments.count??null,pendingRecords:payments.data||[],handoffs:handoffs.count??null,conversations:previews,canManage:!preview&&permissions.has("customers.manage"),canViewPayments,canViewConversations,canViewHandoffs,details};
}
