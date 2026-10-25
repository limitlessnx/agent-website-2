import { createAdminClient } from "@/lib/supabase/admin";
import { FLUX_PLAN_DEFINITIONS, type FluxPlanCode } from "@/lib/fluxknight-plans";
import { resolveActiveRealEstateOrganization } from "@/lib/real-estate-organization";

export type ReadinessCheck = {
  key: string;
  status: "ready" | "missing" | "unverified" | "not_entitled";
  detail: string;
};

type CountResult = { count: number | null; error: string | null };

export async function getRealEstateReadiness(organizationId: string) {
  const id = organizationId.trim();
  if (!id) throw new Error("Organization is required.");

  const admin = createAdminClient();
  const organization = await resolveActiveRealEstateOrganization(admin, id);
  if (!organization) throw new Error("An active real-estate organization is required for readiness checks.");

  const count = async (table: string): Promise<CountResult> => {
    const result = await admin.from(table).select("id", { count: "exact", head: true }).eq("organization_id", id);
    return result.error ? { count: null, error: result.error.message } : { count: result.count ?? 0, error: null };
  };

  const [properties, estates, inspections, handoffs, followups, appointments, integrations, agents, resources, wallet] = await Promise.all([
    count("properties"),
    count("real_estate_estates"),
    count("real_estate_inspections"),
    count("human_handoffs"),
    count("follow_ups"),
    count("appointments"),
    admin.from("organization_integrations").select("id,provider,status,last_checked_at").eq("organization_id", id).limit(30),
    admin.from("agents").select("id,slug,status,human_handoff_destination").eq("organization_id", id).eq("slug", "maia").limit(2),
    admin.from("organization_calendar_resources").select("id,status,assigned_membership_id").eq("organization_id", id).limit(100),
    admin.from("flux_credit_wallets").select("plan_code,status").eq("organization_id", id).limit(2).maybeSingle(),
  ]);

  const checks: ReadinessCheck[] = [{
    key: "organization_scope",
    status: "ready",
    detail: `${organization.name} is active and classified as a real-estate organization. All readiness reads use this organization ID.`,
  }];

  const integrationRows = (integrations.data || []) as Array<{ id: string; provider: string; status: string | null; last_checked_at: string | null }>;
  const whatsapp = integrationRows.filter(row => row.provider === "whatsapp");
  if (integrations.error) {
    checks.push({ key: "whatsapp", status: "unverified", detail: "Integration state could not be verified from the tenant-scoped integration table." });
  } else if (whatsapp.length === 0) {
    checks.push({ key: "whatsapp", status: "missing", detail: "No WhatsApp integration is recorded for this organization." });
  } else if (whatsapp.length > 1) {
    checks.push({ key: "whatsapp", status: "unverified", detail: `${whatsapp.length} WhatsApp integration records exist; resolve the duplicate configuration and verify a controlled delivery.` });
  } else {
    const row = whatsapp[0];
    checks.push({ key: "whatsapp", status: "unverified", detail: `Configuration is ${row.status || "unknown"}; last recorded check ${row.last_checked_at || "unknown"}. A controlled inbound/outbound test is required.` });
  }

  const agentRows = (agents.data || []) as Array<{ id: string; slug: string; status: string | null; human_handoff_destination?: unknown }>;
  const agent = agentRows.length === 1 ? agentRows[0] : undefined;
  if (agents.error) {
    checks.push({ key: "maia", status: "unverified", detail: "Maia agent state could not be verified from the tenant-scoped agent table." });
  } else if (agentRows.length === 0) {
    checks.push({ key: "maia", status: "missing", detail: "No Maia agent is configured for this organization." });
  } else if (agentRows.length > 1) {
    checks.push({ key: "maia", status: "unverified", detail: `${agentRows.length} Maia agent records exist; resolve the duplicate before activation.` });
  } else {
    checks.push({ key: "maia", status: "unverified", detail: `Maia is ${agent!.status || "unknown"}. An active record alone is not proof of a working inbound path.` });
  }

  const destination = agent?.human_handoff_destination && typeof agent.human_handoff_destination === "object"
    ? agent.human_handoff_destination as Record<string, unknown>
    : undefined;
  if (agents.error || agentRows.length > 1) {
    checks.push({ key: "handover", status: "unverified", detail: "A single active Maia destination could not be confirmed because the tenant agent state is unavailable or duplicated." });
  } else if (!destination?.destination) {
    checks.push({ key: "handover", status: "missing", detail: "Configure a tenant-specific handover destination." });
  } else {
    checks.push({ key: "handover", status: "unverified", detail: "A tenant-specific destination exists; verify end-to-end provider delivery before marking handover ready." });
  }

  const resourceRows = (resources.data || []) as Array<{ id: string; status: string | null; assigned_membership_id?: string | null }>;
  const activeResources = resourceRows.filter(row => row.status === "active");
  if (resources.error) {
    checks.push({ key: "calendar", status: "unverified", detail: "Calendar resources could not be verified for this organization." });
  } else if (activeResources.length === 0) {
    checks.push({ key: "calendar", status: "missing", detail: "No active calendar resource exists; requests cannot become confirmed bookings." });
  } else {
    checks.push({ key: "calendar", status: "unverified", detail: `${activeResources.length} active resource(s) are recorded. Provider authorization and live free/busy must be verified before booking.` });
  }

  const walletRow = wallet.data;
  const planCode = String(walletRow?.plan_code || "") as FluxPlanCode;
  const plan = FLUX_PLAN_DEFINITIONS[planCode];
  if (wallet.error) {
    checks.push({ key: "entitlements", status: "unverified", detail: "The tenant wallet or its uniqueness could not be verified." });
  } else if (!walletRow || !plan) {
    checks.push({ key: "entitlements", status: "missing", detail: "No single valid Flux wallet/package was found for this organization." });
  } else if (walletRow.status !== "active") {
    checks.push({ key: "entitlements", status: "unverified", detail: `${plan.name} package exists, but the wallet is ${walletRow.status || "unknown"}; no entitlement or balance was changed.` });
  } else {
    checks.push({ key: "entitlements", status: "ready", detail: `${plan.name} package and active wallet are recorded. This check never changes the package or balance.` });
  }

  const walletOperational = !wallet.error && Boolean(walletRow && plan && walletRow.status === "active");
  for (const [key, feature, label] of [
    ["followups", "follow_ups", "Automated follow-ups"],
    ["reminders", "reminders", "Automated reminders"],
  ] as const) {
    if (wallet.error || !walletRow || !plan) {
      checks.push({ key, status: "unverified", detail: `${label} entitlement cannot be determined until the tenant wallet and package are verified.` });
    } else if (!plan.includedFeatures.includes(feature)) {
      checks.push({ key, status: "not_entitled", detail: `${label} are not included in the current package. Core AI replies and human handover remain separate.` });
    } else if (!walletOperational) {
      checks.push({ key, status: "unverified", detail: `${label} are package-entitled, but the wallet is not active; scheduler delivery must remain unverified.` });
    } else {
      checks.push({ key, status: "unverified", detail: `${label} are package-entitled; scheduler deployment, tenant opt-in and controlled execution still require verification.` });
    }
  }

  checks.push({
    key: "property_inventory",
    status: properties.error ? "unverified" : properties.count === 0 ? "missing" : "unverified",
    detail: properties.error ? "Property inventory could not be verified for this organization." : properties.count === 0 ? "No canonical property records exist; Maia cannot offer an active listing." : `${properties.count} canonical property record(s) exist; listing completeness and current availability require review.`,
  });
  checks.push({
    key: "estate_catalog",
    status: estates.error ? "unverified" : "ready",
    detail: estates.error ? "Estate schema is unavailable or inaccessible; apply only the reviewed migration in an authorized release." : `${estates.count} estate record(s); schema is available and no tenant data is copied.`,
  });

  return {
    checks,
    counts: { properties, estates, inspections, handoffs, followups, appointments },
    plan: plan ? { code: plan.code, name: plan.name, features: plan.includedFeatures } : null,
    overall: checks.every(check => check.status === "ready") ? "ready" : "attention_required",
  };
}
