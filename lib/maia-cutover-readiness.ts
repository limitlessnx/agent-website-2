import { createAdminClient } from "@/lib/supabase/admin";
import { checkWhatsAppReadiness } from "@/lib/whatsapp-integration";

type Check = {
  key: string;
  ok: boolean;
  detail: string;
  count?: number;
};

export async function checkMaiaLiveCutoverReadiness(organizationId: string) {
  const admin = createAdminClient();

  const [
    whatsapp,
    agents,
    properties,
    leads,
    knowledgeCollections,
    knowledgeSources,
    followUpPolicies,
    paymentPlans,
    reminderTemplates,
  ] = await Promise.all([
    checkWhatsAppReadiness(organizationId),
    admin.from("agents").select("id,slug,status,communication_channels").eq("organization_id", organizationId).in("status", ["published", "active"]),
    admin.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("knowledge_collections").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("knowledge_sources").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("organization_follow_up_policies").select("id,status,sequence,stop_conditions").eq("organization_id", organizationId),
    admin.from("payment_plans").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    admin.from("reminder_templates").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
  ]);

  const maia = (agents.data || []).find((agent) => String(agent.slug || "").toLowerCase() === "maia");
  const maiaChannels = Array.isArray(maia?.communication_channels) ? maia.communication_channels.map(String) : [];
  const followPolicy = (followUpPolicies.data || [])[0];
  const checks: Check[] = [
    {
      key: "maia_agent",
      ok: Boolean(maia?.id),
      detail: maia ? "A published Maia agent exists for this tenant." : "No published Maia agent is assigned to this tenant.",
    },
    {
      key: "maia_whatsapp_channel",
      ok: Boolean(maia && maiaChannels.includes("whatsapp")),
      detail: maiaChannels.includes("whatsapp") ? "Maia is configured for WhatsApp." : "Maia is not configured for WhatsApp.",
    },
    {
      key: "properties",
      ok: !properties.error && Number(properties.count || 0) > 0,
      detail: properties.error ? properties.error.message : `${properties.count || 0} tenant-scoped properties are available.`,
      count: properties.count || 0,
    },
    {
      key: "lead_store",
      ok: !leads.error,
      detail: leads.error ? leads.error.message : `${leads.count || 0} tenant-scoped lead records are available.`,
      count: leads.count || 0,
    },
    {
      key: "knowledge_collections",
      ok: !knowledgeCollections.error && Number(knowledgeCollections.count || 0) > 0,
      detail: knowledgeCollections.error ? knowledgeCollections.error.message : `${knowledgeCollections.count || 0} knowledge collections are available.`,
      count: knowledgeCollections.count || 0,
    },
    {
      key: "knowledge_sources",
      ok: !knowledgeSources.error && Number(knowledgeSources.count || 0) > 0,
      detail: knowledgeSources.error ? knowledgeSources.error.message : `${knowledgeSources.count || 0} knowledge sources are available.`,
      count: knowledgeSources.count || 0,
    },
    {
      key: "follow_up_policy",
      ok: Boolean(followPolicy?.id && String(followPolicy.status || "").toLowerCase() === "active"),
      detail: followPolicy?.id ? `Follow-up policy status: ${followPolicy.status || "unknown"}.` : "No tenant follow-up policy is configured.",
    },
    {
      key: "installment_foundation",
      ok: !paymentPlans.error && !reminderTemplates.error,
      detail: paymentPlans.error || reminderTemplates.error
        ? paymentPlans.error?.message || reminderTemplates.error?.message || "Installment data check failed."
        : `Installment foundation available: ${paymentPlans.count || 0} plans and ${reminderTemplates.count || 0} reminder templates.`,
    },
    ...whatsapp.checks.map((check) => ({
      key: `whatsapp_${check.key}`,
      ok: check.ok,
      detail: check.detail,
    })),
  ];

  const hardGateKeys = new Set([
    "maia_agent",
    "maia_whatsapp_channel",
    "properties",
    "lead_store",
    "knowledge_collections",
    "knowledge_sources",
    "whatsapp_credentials",
    "whatsapp_meta_phone",
    "whatsapp_webhook_signature",
    "whatsapp_verify_token",
    "whatsapp_trigger_runtime",
  ]);
  const hardGateChecks = checks.filter((check) => hardGateKeys.has(check.key));
  const readyForLiveTraffic = hardGateChecks.length > 0 && hardGateChecks.every((check) => check.ok);

  return {
    organizationId,
    agentId: maia?.id || null,
    readyForLiveTraffic,
    whatsapp,
    checks,
    optionalFeatureReadiness: {
      contextualFollowUp: Boolean(followPolicy?.id && String(followPolicy.status || "").toLowerCase() === "active"),
      installmentReminders: !paymentPlans.error && !reminderTemplates.error,
    },
  };
}
