import { assertLeoToolAllowed, enforceLeoOrganizationScope, type LeoIdentity } from "@/lib/leo-core";
import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { isHotelOrganization } from "@/lib/hotel-communication-policy";
import { isRealEstateOrganizationRecord } from "@/lib/real-estate-organization";
import { CRM_FOLLOWUP_TOOL, principal, type CrmAction } from "./contract";

/** Re-read membership/permissions at enqueue, polling and worker time. */
export async function currentCrmIdentity(identity: LeoIdentity, organizationId: string): Promise<LeoIdentity> {
  principal(identity);
  if (enforceLeoOrganizationScope(identity, organizationId) !== organizationId) throw new Error("Cross-tenant Leo execution blocked.");
  let current = identity;
  if (identity.scope === "tenant") {
    const access = await getOrganizationAccessContext(organizationId, identity.userId!);
    if (identity.membershipId && access.membershipId !== identity.membershipId) throw new Error("Leo membership changed.");
    current = { ...identity, permissions: [...access.permissions] };
  } else {
    const configured = (process.env.LIMITLESS_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    if (!configured || identity.email?.trim().toLowerCase() !== configured) throw new Error("Leo admin authorization is no longer current.");
  }
  assertLeoToolAllowed(current, CRM_FOLLOWUP_TOOL);
  return current;
}

export async function validateCrmBindings(action: CrmAction) {
  const db = createAdminClient();
  const [organization, agent, customer, profile, guest, handoff] = await Promise.all([
    db.from("organizations").select("id,slug,status,metadata").eq("id", action.organization_id).single(),
    db.from("agents").select("id,status").eq("organization_id", action.organization_id).eq("id", action.agent_id).single(),
    db.from("crm_customers").select("id,phone,metadata").eq("organization_id", action.organization_id).eq("id", action.customer_id).single(),
    db.from("client_onboarding_profiles").select("industry").eq("organization_id", action.organization_id).maybeSingle(),
    db.from("hotel_guest_profiles").select("customer_id").eq("organization_id", action.organization_id).eq("customer_id", action.customer_id).maybeSingle(),
    db.from("human_handoffs").select("id").eq("organization_id", action.organization_id).eq("customer_id", action.customer_id)
      .in("status", ["open", "assigned", "in_progress", "waiting_customer"]).limit(1).maybeSingle(),
  ]);
  for (const item of [organization, agent, customer, profile, guest, handoff]) if (item.error) throw item.error;
  if (organization.data?.status !== "active" || !["active", "published"].includes(agent.data?.status)) throw new Error("Active tenant and agent binding required.");
  // Domain-specific booking, consent and real-estate approval rules retain their own paths.
  if (isHotelOrganization(organization.data) || isHotelOrganization({ metadata: { industry: profile.data?.industry } }) || guest.data || isRealEstateOrganizationRecord(organization.data) || isRealEstateOrganizationRecord({ metadata: { industry: profile.data?.industry } })) throw new Error("Use the existing hotel or real-estate follow-up path for this organization.");
  const metadata = (customer.data?.metadata || {}) as Record<string, unknown>;
  if (handoff.data) throw new Error("An active human handoff blocks CRM follow-up.");
  if (metadata.opted_out === true || metadata.do_not_contact === true || !customer.data?.phone) throw new Error("CRM customer cannot be contacted.");
  return customer.data as { id: string; phone: string; metadata: Record<string, unknown> };
}
