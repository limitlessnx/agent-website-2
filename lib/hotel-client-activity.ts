import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { createAdminClient } from "@/lib/supabase/admin";
import { HotelWorkspaceError, hotelUuid } from "@/lib/hotel-booking-service";
import { hotelLocalDay } from "@/lib/hotel-overview-contract";

export type HotelInboxRow = { id: string; customer_id: string; guest_name: string; channel: string; status: string; ai_mode: string | null; updated_at: string; preview: string };
export function hotelActivityPage(value: unknown) { const page = Number(value || 0); if (!Number.isInteger(page) || page < 0 || page > 100000) throw new HotelWorkspaceError("Choose a valid page."); return page; }
export async function hotelActivityAccess(kind: "inbox" | "followups") {
  const session = await getClientSession();
  if (!session) throw new HotelWorkspaceError("Sign in to this workspace.", 401);
  try { if (!session.isAdminPreview) await requirePortalPermission(session, kind === "inbox" ? ["conversations.view", "conversations.reply"] : ["customers.view", "customers.manage"]); await requireHotelOrganization(session.organizationId); }
  catch { throw new HotelWorkspaceError("Hotel workspace permission required.", 403); }
  return session;
}
export async function hotelActivityTimezone(org: string) {
  const result = await createAdminClient().from("client_onboarding_profiles").select("timezone").eq("organization_id", org).maybeSingle();
  if (result.error) throw new HotelWorkspaceError("Hotel timezone is unavailable.", 503);
  return hotelLocalDay(result.data?.timezone).timeZone;
}
export async function loadHotelInbox(org: string, query: string, status: string, page: number): Promise<{ rows: HotelInboxRow[]; total: number }> {
  if (query.length > 120 || status.length > 40) throw new HotelWorkspaceError("Refine the conversation search.");
  const result = await createAdminClient().rpc("hotel_conversation_index", { p_organization_id: org, p_query: query, p_status: status, p_page: hotelActivityPage(page) });
  if (result.error || !result.data) throw new HotelWorkspaceError("Guest conversations could not be loaded. Try again.", 503);
  return result.data;
}
export async function loadHotelThread(org: string, id: string, page: number) {
  hotelUuid(id, "Conversation"); const admin = createAdminClient();
  const conversation = await admin.from("crm_conversations").select("id,customer_id,channel,status,metadata").eq("organization_id", org).eq("id", id).maybeSingle();
  if (conversation.error) throw new HotelWorkspaceError("Conversation is unavailable.", 503);
  if (!conversation.data) throw new HotelWorkspaceError("Conversation not found in this hotel.", 404);
  const customerId = conversation.data.customer_id;
  const offset = hotelActivityPage(page) * 100;
  const [customer, messages] = await Promise.all([
    admin.from("crm_customers").select("id,full_name").eq("organization_id", org).eq("id", customerId).maybeSingle(),
    admin.from("crm_messages").select("id,sender_type,direction,content,status,created_at", { count: "exact" }).eq("organization_id", org).eq("conversation_id", id).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 99),
  ]);
  if (customer.error || messages.error) throw new HotelWorkspaceError("Conversation history is unavailable.", 503);
  return { conversation: conversation.data, guest: customer.data?.full_name || "Guest", messages: (messages.data || []).reverse(), total: messages.count || 0 };
}
export async function loadHotelFollowupLog(org: string, purpose: string, status: string, page: number) {
  if (purpose && !["booking_recovery", "pre_arrival", "post_stay"].includes(purpose) || status && !["pending", "processing", "cancelled", "accepted", "unknown"].includes(status)) throw new HotelWorkspaceError("Choose a valid reminder filter.");
  const admin = createAdminClient(), offset = hotelActivityPage(page) * 50;
  let query = admin.from("hotel_followups").select("id,customer_id,booking_id,purpose,scheduled_at,status,stop_reason,provider_message_id", { count: "exact" }).eq("organization_id", org);
  if (purpose) query = query.eq("purpose", purpose);
  if (status) query = query.eq("status", status);
  const result = await query.order("scheduled_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 49);
  if (result.error) throw new HotelWorkspaceError("Follow-up history is unavailable.", 503);
  const ids = [...new Set((result.data || []).map(row => row.customer_id))];
  const customers = ids.length ? await admin.from("crm_customers").select("id,full_name").eq("organization_id", org).in("id", ids) : { data: [], error: null };
  if (customers.error) throw new HotelWorkspaceError("Guest names could not be loaded.", 503);
  return { total: result.count || 0, rows: (result.data || []).map(row => ({ ...row, guest_name: customers.data?.find(customer => customer.id === row.customer_id)?.full_name || "Guest" })) };
}
