import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { isHotelOrganization, hotelFollowupSuppression, withinWhatsAppWindow, type HotelGuest, type HotelEnquiry } from "@/lib/hotel-communication-policy";

export async function requireHotelOrganization(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("status,metadata").eq("id", organizationId).single();
  if (error) throw error;
  let hotel = isHotelOrganization(data);
  if (!hotel) {
    const profile = await admin.from("client_onboarding_profiles").select("industry").eq("organization_id", organizationId).maybeSingle();
    if (profile.error) throw profile.error;
    hotel = isHotelOrganization({ metadata: { industry: profile.data?.industry } });
  }
  if (data.status !== "active" || !hotel) throw new Error("An active hotel organization is required.");
}

export async function loadHotelAudience(organizationId: string, customerIds: string[]) {
  const admin = createAdminClient();
  const [guests, bookings] = await Promise.all([
    admin.from("hotel_guest_profiles").select("*").eq("organization_id", organizationId).in("customer_id", customerIds),
    admin.from("hotel_booking_enquiries").select("*").eq("organization_id", organizationId).in("customer_id", customerIds),
  ]);
  if (guests.error || bookings.error) throw guests.error || bookings.error;
  return { guests: guests.data as HotelGuest[], bookings: bookings.data as HotelEnquiry[] };
}

// Reads canonical inbound messages, never a caller-supplied timestamp or outbound activity.
export async function hotelConversationState(organizationId: string, customerId: string) {
  const admin = createAdminClient();
  const customer = await admin.from("crm_customers").select("phone").eq("organization_id", organizationId).eq("id", customerId).single();
  if (customer.error) throw customer.error;
  const phone = String(customer.data?.phone || "").replace(/\D/g, "");
  if (phone) {
    const handoff = await admin.from("agent_conversations").select("ai_paused,status").eq("organization_id", organizationId).eq("external_thread_key", phone).maybeSingle();
    if (handoff.error) throw handoff.error;
    if (handoff.data?.ai_paused || ["handoff", "human_active", "human_handoff"].includes(String(handoff.data?.status))) return { handoff: true, lastInboundAt: null };
  }
  const conversations = await admin.from("crm_conversations").select("id,status").eq("organization_id", organizationId).eq("customer_id", customerId).eq("channel", "whatsapp");
  if (conversations.error) throw conversations.error;
  const rows = conversations.data || [];
  if (rows.some(row => ["handoff", "human_active", "human_handoff"].includes(row.status))) return { handoff: true, lastInboundAt: null };
  if (!rows.length) return { handoff: false, lastInboundAt: null };
  const inbound = await admin.from("crm_messages").select("created_at").eq("organization_id", organizationId).in("conversation_id", rows.map(row => row.id)).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (inbound.error) throw inbound.error;
  return { handoff: false, lastInboundAt: inbound.data?.created_at || null };
}

export async function processDueHotelFollowups(organizationId: string, limit = 25) {
  await requireHotelOrganization(organizationId);
  await assertFluxFeatureAccess(organizationId, "follow_ups");
  const admin = createAdminClient();
  const due = await admin.from("hotel_followups").select("*").eq("organization_id", organizationId).eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(Math.max(1, Math.min(limit, 100)));
  if (due.error) throw due.error;
  const results = [];
  for (const job of due.data || []) {
    // Compare-and-set claim: retries and concurrent drains cannot send the same job twice.
    const claim = await admin.from("hotel_followups").update({ status: "processing" }).eq("organization_id", organizationId).eq("id", job.id).eq("status", "pending").select("id").maybeSingle();
    if (claim.error) throw claim.error;
    if (!claim.data) continue;
    let status = "cancelled";
    let reason: string | null = null;
    let providerMessageId: string | null = null;
    try {
      const audience = await loadHotelAudience(organizationId, [job.customer_id]);
      const booking = audience.bookings.find(b => b.id === job.booking_id) || null;
      reason = hotelFollowupSuppression({ organizationId, customerId: job.customer_id, guest: audience.guests[0] || null, booking, bookingRevision: job.booking_revision, purpose: job.purpose });
      const conversation = await hotelConversationState(organizationId, job.customer_id);
      if (conversation.handoff) reason = "human_handoff";
      if (conversation.lastInboundAt && Date.parse(conversation.lastInboundAt) > Date.parse(job.created_at)) reason = "guest_replied";
      if (!reason) {
        const customer = await admin.from("crm_customers").select("phone,full_name").eq("organization_id", organizationId).eq("id", job.customer_id).single();
        if (customer.error || !customer.data?.phone) throw customer.error || new Error("Guest phone is unavailable.");
        // Recheck persisted cancellation immediately before entering the provider boundary.
        const current = await admin.from("hotel_followups").select("status").eq("organization_id", organizationId).eq("id", job.id).single();
        if (current.error) throw current.error;
        if (current.data.status !== "processing") reason = "booking_changed";
        else {
          // Unknown outcomes are never automatically retried (provider acceptance may have occurred).
          status = "unknown";
          const delivery = await sendWhatsAppMessage({ organizationId, to: customer.data.phone, text: job.message,
            lastCustomerMessageAt: conversation.lastInboundAt,
            deliveryMode: withinWhatsAppWindow(conversation.lastInboundAt) ? "direct" : "template",
            templatePurpose: `hotel_${job.purpose}`, requestedTemplateName: job.template_name || undefined,
            requireProviderApproval: true, variables: { customer_name: customer.data.full_name || "", message: job.message,
              booking_status: booking!.status, arrival_date: booking!.arrival_date || "", departure_date: booking!.departure_date || "" },
          });
          providerMessageId = delivery.providerMessageId || null;
          status = providerMessageId ? "accepted" : "unknown";
        }
      }
    } catch (error) { reason = error instanceof Error ? error.message : "Hotel follow-up unavailable"; status = "unknown"; }
    const updated = await admin.from("hotel_followups").update({ status, stop_reason: reason, provider_message_id: providerMessageId }).eq("organization_id", organizationId).eq("id", job.id).eq("status", "processing");
    if (updated.error) throw updated.error;
    results.push({ id: job.id, status, reason });
  }
  return { processed: results.length, results };
}
