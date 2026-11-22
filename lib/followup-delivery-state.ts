import { createAdminClient } from "@/lib/supabase/admin";

type Delivery = { follow_up_id: string; delivery_status: string; error_message: string | null };

/** Latest attempt per step. Read-only: a failed receipt never reopens an accepted send. */
export async function getFollowupDeliveryStates(organizationId: string, stepIds: string[]) {
  if (!organizationId) throw new Error("Organization context is required.");
  const admin = createAdminClient();
  const states: Record<string, Delivery> = {};
  const ids = [...new Set(stepIds)];
  for (let offset = 0; offset < ids.length; offset += 50) {
    const result = await admin.from("real_estate_outbound_tracking")
      .select("follow_up_id,delivery_status,error_message", { count: "exact" })
      .eq("organization_id", organizationId).eq("outbound_kind", "followup")
      .in("follow_up_id", ids.slice(offset, offset + 50)).order("created_at", { ascending: false }).limit(1000);
    if (result.error || (result.count ?? result.data?.length ?? 0) > 1000) throw new Error("Follow-up delivery outcomes are unavailable.");
    for (const row of (result.data || []) as Delivery[]) {
      if (!states[row.follow_up_id]) states[row.follow_up_id] = row;
    }
  }
  return states;
}
