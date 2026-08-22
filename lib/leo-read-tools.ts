import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { enforceLeoOrganizationScope, type LeoIdentity } from "@/lib/leo-core";
import { getAgentManagementSummary } from "@/lib/agent-management";
import { getPlatformEngineSummary } from "@/lib/platform-engine";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import { getDetailedCampaignReports } from "@/lib/campaign-report-reader";
import { getRecentWhatsAppStatuses } from "@/lib/whatsapp-status-log";
import { getCampaignAudienceLeads } from "@/lib/lead-profile-service";

function safeText(value: unknown, max = 500) {
  if (typeof value !== "string") return value;
  return value.replace(/https?:\/\/\S+/gi, "[url]").slice(0, max);
}

function safeRow(row: Record<string, unknown>) {
  const blocked = new Set(["access_token", "refresh_token", "api_key", "secret", "password", "credential", "credentials", "authorization", "private_key"]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !blocked.has(key.toLowerCase())).map(([key, value]) => [key, typeof value === "string" ? safeText(value) : value]));
}

function scopedQuery(identity: LeoIdentity, base: string) {
  const organizationId = enforceLeoOrganizationScope(identity);
  if (!organizationId) return base;
  return `${base}${base.includes("?") ? "&" : "?"}organization_id=eq.${encodeURIComponent(organizationId)}`;
}

type LeoReadToolResult = Record<string, unknown>;

type LeoReadToolInput = {
  identity: LeoIdentity;
  toolKey: string;
  arguments?: Record<string, unknown>;
};

function searchText(args: Record<string, unknown>) {
  return String(args.query || args.search || args.name || "").trim().toLowerCase().slice(0, 120);
}

function matchesSearch(row: Record<string, unknown>, query: string, fields: string[]) {
  if (!query) return true;
  return fields.some((field) => String(row[field] || "").toLowerCase().includes(query));
}

function isLimitlessRealtyRequest(args: Record<string, unknown>) {
  const value = String(args.organizationName || args.organization_name || args.organizationSlug || args.organization_slug || args.organizationKey || args.organization_key || "").trim().toLowerCase();
  return value === "limitless realty" || value === "limitless-realty" || value === "limitless_realty";
}

export async function executeLeoReadTool(input: LeoReadToolInput): Promise<LeoReadToolResult> {
  const { identity, toolKey } = input;
  const args = input.arguments || {};
  const requestedId = typeof args.id === "string" ? args.id.trim() : "";
  const organizationId = enforceLeoOrganizationScope(
    identity,
    typeof args.organizationId === "string" ? args.organizationId : undefined,
  );

  if (toolKey === "leo.agent.inspect") {
    const summary = await getAgentManagementSummary();
    const selected = requestedId ? summary.agents.find((agent) => agent.id === requestedId) : null;
    return {
      tool: toolKey,
      scope: organizationId || identity.scope,
      selected: selected ? safeRow(selected as unknown as Record<string, unknown>) : null,
      summary: {
        total: summary.agents.length,
        configured: summary.configured,
        active: summary.agents.filter((agent) => agent.status === "active").length,
        paused: summary.agents.filter((agent) => agent.status === "paused").length,
        errors: summary.agents.filter((agent) => agent.status === "error").length,
      },
    };
  }

  if (toolKey === "leo.workflow.inspect" || toolKey === "leo.workflow.inspect_failures") {
    const summary = await getWorkflowRegistrySummary();
    const selected = requestedId ? summary.workflows.find((workflow) => workflow.id === requestedId) : null;
    const runs = selected ? summary.runs.filter((run) => run.workflow_id === selected.id) : summary.runs;
    const filteredRuns = toolKey === "leo.workflow.inspect_failures"
      ? runs.filter((run) => ["failed", "error", "timed_out"].includes(String(run.status).toLowerCase()))
      : runs;
    return {
      tool: toolKey,
      scope: organizationId || identity.scope,
      selected: selected ? safeRow(selected as unknown as Record<string, unknown>) : null,
      summary: {
        configured: summary.configured,
        active: summary.active,
        paused: summary.paused,
        failures: summary.failures,
        successRate: summary.successRate,
      },
      runs: filteredRuns.slice(0, 25).map((run) => safeRow(run as unknown as Record<string, unknown>)),
    };
  }

  if (toolKey === "leo.integration.inspect") {
    const summary = await getPlatformEngineSummary();
    const selected = requestedId ? summary.integrations.find((integration) => integration.id === requestedId) : null;
    const integrations = selected ? [selected] : summary.integrations;
    return {
      tool: toolKey,
      scope: organizationId || identity.scope,
      selected: selected ? safeRow(selected as unknown as Record<string, unknown>) : null,
      integrations: integrations.slice(0, 50).map((integration) => safeRow(integration as unknown as Record<string, unknown>)),
    };
  }

  if (toolKey === "leo.crm.leads.read") {
    const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
    const query = scopedQuery(identity, `crm_leads?select=id,organization_id,customer_id,stage,source,created_at,updated_at,summary,details&order=created_at.desc&limit=${limit}`);
    const crmLeads = await supabaseServerRequest<Record<string, unknown>[]>(query).catch(() => []);
    const queryText = searchText(args);
    let leads = crmLeads;

    // Limitless Realty's existing campaign center uses the legacy `leads` store.
    // Super Admin Leo may inspect that source only when the request explicitly resolves to Limitless Realty.
    if (identity.scope === "super_admin" && isLimitlessRealtyRequest(args)) {
      const legacyLeads = await getCampaignAudienceLeads(Math.min(limit, 100)).catch(() => []);
      leads = legacyLeads
        .filter((lead) => matchesSearch(lead as unknown as Record<string, unknown>, queryText, ["name", "phone", "email", "property_interest", "property_type"]))
        .map((lead) => ({
          id: lead.id,
          source: "limitless_realty_campaign_leads",
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          status: lead.status,
          score: lead.score,
          propertyInterest: lead.property_interest,
          propertyType: lead.property_type,
          budget: lead.budget,
          locationPreference: lead.location_preference,
          campaignEligible: lead.campaign_eligible,
          profileStatus: lead.profile_status,
          followUpStage: (lead as Record<string, unknown>).follow_up_stage,
          lastFollowUpAt: (lead as Record<string, unknown>).last_follow_up_at,
          createdAt: lead.created_at,
        }));
    } else if (queryText) {
      leads = leads.filter((lead) => matchesSearch(lead, queryText, ["id", "stage", "source", "summary", "customer_id"]));
    }

    const phoneCandidates = leads.map((lead) => String(lead.phone || "").trim()).filter(Boolean).slice(0, 20);
    const paymentQuery = identity.scope === "tenant" && organizationId
      ? `payment_plans?select=id,client_name,client_phone,property_title,agreed_price,total_paid,outstanding_balance,status,next_due_date,final_due_date&organization_id=eq.${encodeURIComponent(organizationId)}&limit=100`
      : "payment_plans?select=id,organization_id,client_name,client_phone,property_title,agreed_price,total_paid,outstanding_balance,status,next_due_date,final_due_date&limit=100";
    const paymentPlans = phoneCandidates.length
      ? await supabaseServerRequest<Record<string, unknown>[]>(paymentQuery).catch(() => [])
      : [];
    const paymentByPhone = new Map(paymentPlans.map((plan) => [String(plan.client_phone || "").replace(/\D/g, ""), safeRow(plan)]));

    const enriched = leads.map((lead) => {
      const phone = String(lead.phone || "").replace(/\D/g, "");
      return { ...safeRow(lead), paymentPlan: phone ? paymentByPhone.get(phone) || null : null };
    });

    return {
      tool: toolKey,
      scope: organizationId || identity.scope,
      requestedOrganization: isLimitlessRealtyRequest(args) ? "Limitless Realty" : organizationId || null,
      search: queryText || null,
      count: enriched.length,
      leads: enriched,
    };
  }

  if (toolKey === "leo.billing.inspect") {
    const query = organizationId
      ? `organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`
      : "organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&order=updated_at.desc&limit=50";
    const [subscriptions, plans] = await Promise.all([
      supabaseServerRequest<Record<string, unknown>[]>(query),
      supabaseServerRequest<Record<string, unknown>[]>("billing_plans?select=id,name,status&order=created_at.asc"),
    ]);
    return {
      tool: toolKey,
      scope: organizationId || identity.scope,
      subscriptions: subscriptions.map(safeRow),
      plans: plans.map(safeRow),
    };
  }

  if (toolKey === "leo.tenant.inspect") {
    const [agents, workflows, integrations] = await Promise.all([
      executeLeoReadTool({ identity, toolKey: "leo.agent.inspect", arguments: {} }),
      executeLeoReadTool({ identity, toolKey: "leo.workflow.inspect_failures", arguments: {} }),
      executeLeoReadTool({ identity, toolKey: "leo.integration.inspect", arguments: {} }),
    ]);
    const diagnosticFocus = String(args.focus || args.query || "").toLowerCase();
    const shouldInspectMessaging = identity.scope === "super_admin" || /campaign|message|whatsapp|delivery|template|follow.?up/.test(diagnosticFocus);
    const campaignReports = shouldInspectMessaging ? await getDetailedCampaignReports(50).catch(() => []) : [];
    const whatsappStatuses = shouldInspectMessaging ? await getRecentWhatsAppStatuses(250).catch(() => []) : [];
    const failures = whatsappStatuses.filter((status) => status.status === "failed").slice(0, 40).map((status) => safeRow({ messageId: status.message_id, recipientId: status.recipient_id, status: status.status, errorCode: status.error_code, errorTitle: status.error_title, errorDetails: status.error_details, createdAt: status.created_at }));
    const campaignSummary = campaignReports.reduce((summary, report) => ({
      total: summary.total + 1,
      attempted: summary.attempted + report.attempted,
      accepted: summary.accepted + report.accepted,
      delivered: summary.delivered + report.delivered,
      failed: summary.failed + report.failed,
      skipped: summary.skipped + report.skipped,
      pending: summary.pending + report.pending_delivery,
    }), { total: 0, attempted: 0, accepted: 0, delivered: 0, failed: 0, skipped: 0, pending: 0 });
    return {
      tool: toolKey,
      scope: organizationId || identity.scope,
      diagnosticFocus: diagnosticFocus || "workspace health",
      agents,
      workflows,
      integrations,
      messagingDiagnostics: shouldInspectMessaging ? {
        campaignSummary,
        recentCampaigns: campaignReports.slice(0, 20).map((report) => safeRow(report as unknown as Record<string, unknown>)),
        recentWhatsAppFailures: failures,
      } : null,
    };
  }

  if (toolKey === "leo.platform.organizations.read") {
    const queryText = searchText(args);
    const organizations = await supabaseServerRequest<Record<string, unknown>[]>("organizations?select=id,name,slug,status,created_at,updated_at&order=created_at.desc&limit=100");
    const filtered = organizations.filter((organization) => matchesSearch(organization, queryText, ["id", "name", "slug", "status"]));
    return {
      tool: toolKey,
      scope: identity.scope,
      search: queryText || null,
      exactMatches: filtered.filter((organization) => String(organization.name || "").toLowerCase() === queryText || String(organization.slug || "").toLowerCase() === queryText),
      count: filtered.length,
      organizations: filtered.map(safeRow),
    };
  }

  throw new Error(`Leo read tool is not implemented: ${toolKey}`);
}
