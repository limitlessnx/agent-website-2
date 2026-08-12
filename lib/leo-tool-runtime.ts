import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEO_PUBLIC_KNOWLEDGE } from "@/lib/leo-public-knowledge";
import {
  assertLeoToolAllowed,
  enforceLeoOrganizationScope,
  type LeoIdentity,
} from "@/lib/leo-core";
import { activateN8nWorkflow, deactivateN8nWorkflow } from "@/lib/n8n-api";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function tenantOrganization(identity: LeoIdentity, args: Record<string, unknown>) {
  const requested = text(args.organization_id) || undefined;
  return enforceLeoOrganizationScope(identity, requested);
}

async function callWorkflow(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(95000),
  });
  const data = await response.json().catch(async () => ({ error: (await response.text().catch(() => "")).slice(0, 800) }));
  if (!response.ok) throw new Error(String((data as Record<string, unknown>).error || `Workflow returned HTTP ${response.status}.`));
  return data as Record<string, unknown>;
}

function n8nWebhook(path: string, override?: string) {
  if (override?.trim()) return override.trim();
  const base = (process.env.LEO_N8N_WEBHOOK_BASE_URL || "https://n8n.srv1720757.hstgr.cloud/webhook").replace(/\/$/, "");
  return `${base}/${path.replace(/^\//, "")}`;
}

function recommendPlan(args: Record<string, unknown>) {
  const channels = array(args.channels).map(text).join(" ").toLowerCase();
  const pain = [args.primary_need, args.pain_point, args.goal].map(text).join(" ").toLowerCase();
  const volume = numberValue(args.monthly_enquiries) || 0;
  const multiChannel = ["whatsapp", "phone", "voice", "email"].filter((item) => channels.includes(item)).length >= 2;
  let key = "whatsapp-ai-starter";
  if (channels.includes("phone") || channels.includes("voice")) key = "ai-call-receptionist";
  if (multiChannel || volume >= 1000 || /front desk|support and sales|multiple channel/.test(pain)) key = "ai-front-desk-suite";
  if (
    /multiple branch|department|custom integration|enterprise|complex workflow|website|web site|landing page|dashboard|portal|ai integration/.test(pain)
    || /website|web site|dashboard|portal|ai integration/.test(channels)
    || volume >= 5000
  ) key = "custom-ai-operations";
  const plan = LEO_PUBLIC_KNOWLEDGE.plans.find((item) => item.key === key) || LEO_PUBLIC_KNOWLEDGE.plans[0];
  return { plan, rationale: `Recommended from the supplied channels, enquiry volume and primary operational need.` };
}

async function capturePublicLead(args: Record<string, unknown>, source: string) {
  const supabase = createAdminClient();
  const name = text(args.name) || text(args.full_name);
  const email = text(args.email);
  const phone = text(args.phone);
  if (!email && !phone) throw new Error("A phone number or email is required to capture this lead.");
  const row = {
    full_name: name || "Website visitor",
    email: email || null,
    phone: phone || null,
    company_name: text(args.company_name) || text(args.business_name) || null,
    industry: text(args.industry) || null,
    recommended_plan: text(args.recommended_plan) || null,
    qualification: record(args.qualification),
    notes: text(args.notes) || null,
    source,
    status: source === "leo_public_demo" ? "demo_requested" : "new",
    metadata: { channel: text(args.channel) || "website", captured_by: "leo_core_v2" },
  };
  const inserted = await supabase.from("leo_public_leads").insert(row).select("id,status,created_at").single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function readTenantLeads(identity: LeoIdentity, args: Record<string, unknown>) {
  const organizationId = tenantOrganization(identity, args);
  if (!organizationId) throw new Error("Organization is required.");
  const supabase = createAdminClient();
  let query = supabase
    .from("crm_leads")
    .select("id,customer_id,assigned_agent_id,source,stage,score,summary,details,created_at,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, Number(args.limit) || 25)));
  if (text(args.stage)) query = query.eq("stage", text(args.stage));
  const result = await query;
  if (result.error) throw result.error;
  return { organization_id: organizationId, leads: result.data || [] };
}

async function updateTenantLead(identity: LeoIdentity, args: Record<string, unknown>) {
  const organizationId = tenantOrganization(identity, args);
  const leadId = text(args.lead_id);
  if (!organizationId || !leadId) throw new Error("organization_id and lead_id are required.");
  const patchInput = record(args.patch);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (text(patchInput.stage)) patch.stage = text(patchInput.stage);
  if (numberValue(patchInput.score) !== null) patch.score = Math.max(0, Math.min(100, Number(patchInput.score)));
  if (text(patchInput.summary)) patch.summary = text(patchInput.summary).slice(0, 1200);
  if (patchInput.details && typeof patchInput.details === "object" && !Array.isArray(patchInput.details)) patch.details = patchInput.details;
  if (Object.keys(patch).length === 1) throw new Error("No permitted lead fields were supplied.");
  const supabase = createAdminClient();
  const result = await supabase.from("crm_leads").update(patch).eq("id", leadId).eq("organization_id", organizationId).select("id,stage,score,summary,updated_at").single();
  if (result.error) throw result.error;
  return { organization_id: organizationId, lead: result.data };
}

async function tenantSnapshot(identity: LeoIdentity, args: Record<string, unknown>) {
  const organizationId = tenantOrganization(identity, args);
  if (!organizationId) throw new Error("Organization is required.");
  const supabase = createAdminClient();
  const [org, agents, integrations, workflows, runs] = await Promise.all([
    supabase.from("organizations").select("id,name,slug,status").eq("id", organizationId).maybeSingle(),
    supabase.from("agents").select("id,name,status,agent_type").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("organization_integrations").select("id,provider,display_name,status,last_checked_at").eq("organization_id", organizationId).limit(50),
    supabase.from("workflow_registry").select("id,name,workflow_key,status,provider,external_workflow_id,last_run_at,last_error_at").eq("organization_uuid", organizationId).limit(100),
    supabase.from("workflow_runs").select("id,workflow_key,status,error_message,created_at").eq("organization_uuid", organizationId).order("created_at", { ascending: false }).limit(25),
  ]);
  for (const item of [org, agents, integrations, workflows, runs]) if (item.error) throw item.error;
  return { organization: org.data || null, agents: agents.data || [], integrations: integrations.data || [], workflows: workflows.data || [], recentRuns: runs.data || [] };
}

async function delegateFollowUp(identity: LeoIdentity, args: Record<string, unknown>) {
  const organizationId = tenantOrganization(identity, args);
  const agentId = text(args.agent_id);
  if (!organizationId || !agentId) throw new Error("organization_id and agent_id are required for follow-up execution.");
  const input = record(args.input);
  const customerKey = text(args.customer_id) || text(args.customer_key) || text(input.email) || text(input.phone);
  if (!customerKey) throw new Error("A customer identifier is required for follow-up execution.");
  return callWorkflow(
    n8nWebhook("fluxknight/crm-follow-up/v3", process.env.LEO_CRM_FOLLOWUP_WEBHOOK_URL),
    {
      organization_id: organizationId,
      agent_id: agentId,
      conversation_id: text(args.conversation_id) || null,
      customer_id: text(args.customer_id) || null,
      customer_key: customerKey,
      lead_id: text(args.lead_id) || null,
      task_id: text(args.task_id) || null,
      idempotency_key: text(args.idempotency_key) || `leo-followup-${randomUUID()}`,
      channel: text(args.channel) || (identity.channel === "voice" ? "voice" : "internal"),
      event_type: "follow_up.manual",
      input: { ...input, requested_by_leo: true, message: text(args.message) || undefined },
    },
  );
}

async function delegateAppointment(identity: LeoIdentity, args: Record<string, unknown>) {
  const organizationId = tenantOrganization(identity, args);
  const agentId = text(args.agent_id);
  if (!organizationId || !agentId) throw new Error("organization_id and agent_id are required for appointment execution.");
  const input = record(args.input);
  const customerKey = text(args.customer_id) || text(args.customer_key) || text(input.email) || text(input.phone);
  if (!customerKey) throw new Error("A customer identifier is required for appointment execution.");
  return callWorkflow(
    n8nWebhook("fluxknight/appointments/v4", process.env.LEO_APPOINTMENT_WEBHOOK_URL),
    {
      organization_id: organizationId,
      agent_id: agentId,
      conversation_id: text(args.conversation_id) || null,
      customer_id: text(args.customer_id) || null,
      appointment_id: text(args.appointment_id) || null,
      idempotency_key: text(args.idempotency_key) || `leo-appointment-${randomUUID()}`,
      channel: text(args.channel) || (identity.channel === "voice" ? "voice" : "internal"),
      event_type: text(args.event_type) || "appointment.requested",
      input: { ...input, customer_key: customerKey, requested_by_leo: true },
    },
  );
}

export async function executeAuthorizedLeoTool(input: {
  identity: LeoIdentity;
  toolKey: string;
  arguments: Record<string, unknown>;
  actor: string;
}) {
  const tool = assertLeoToolAllowed(input.identity, input.toolKey);
  const args = input.arguments;
  const supabase = createAdminClient();

  switch (tool.key) {
    case "leo.public.services.read": return { services: LEO_PUBLIC_KNOWLEDGE.services };
    case "leo.public.industries.read": return { industries: LEO_PUBLIC_KNOWLEDGE.industries };
    case "leo.public.pricing.read": return { plans: LEO_PUBLIC_KNOWLEDGE.plans };
    case "leo.public.plan.recommend": return recommendPlan(args);
    case "leo.public.lead.capture": return { lead: await capturePublicLead(args, "leo_public_website") };
    case "leo.public.demo.book": return { lead: await capturePublicLead(args, "leo_public_demo"), requested: true };

    case "leo.tenant.inspect": return tenantSnapshot(input.identity, args);
    case "leo.agent.inspect": {
      const organizationId = tenantOrganization(input.identity, args);
      const agentId = text(args.agent_id);
      if (!organizationId || !agentId) throw new Error("organization_id and agent_id are required.");
      const result = await supabase.from("agents").select("id,name,status,agent_type,configuration,updated_at").eq("organization_id", organizationId).eq("id", agentId).maybeSingle();
      if (result.error) throw result.error;
      return { agent: result.data || null };
    }
    case "leo.workflow.inspect":
    case "leo.workflow.inspect_failures": {
      const organizationId = tenantOrganization(input.identity, args);
      if (!organizationId) throw new Error("Organization is required.");
      const workflowKey = text(args.workflow_key);
      let query = supabase.from("workflow_runs").select("id,workflow_key,status,error_message,created_at").eq("organization_uuid", organizationId).order("created_at", { ascending: false }).limit(50);
      if (workflowKey) query = query.eq("workflow_key", workflowKey);
      if (tool.key === "leo.workflow.inspect_failures") query = query.in("status", ["failed", "timed_out", "error"]);
      const result = await query;
      if (result.error) throw result.error;
      return { organization_id: organizationId, runs: result.data || [] };
    }
    case "leo.integration.inspect": {
      const organizationId = tenantOrganization(input.identity, args);
      if (!organizationId) throw new Error("Organization is required.");
      const result = await supabase.from("organization_integrations").select("id,provider,display_name,status,last_checked_at").eq("organization_id", organizationId).order("provider");
      if (result.error) throw result.error;
      return { organization_id: organizationId, integrations: result.data || [] };
    }
    case "leo.billing.inspect": {
      const organizationId = tenantOrganization(input.identity, args);
      if (!organizationId) throw new Error("Organization is required.");
      const result = await supabase.from("organization_subscriptions").select("id,plan_id,status,current_period_end,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (result.error) throw result.error;
      return { organization_id: organizationId, subscription: result.data || null };
    }
    case "leo.crm.leads.read": return readTenantLeads(input.identity, args);
    case "leo.crm.leads.update": return updateTenantLead(input.identity, args);
    case "leo.crm.followup.prepare": {
      const organizationId = tenantOrganization(input.identity, args);
      const customerId = text(args.customer_id);
      const leadId = text(args.lead_id) || null;
      const agentId = text(args.agent_id) || null;
      if (!organizationId || !customerId) throw new Error("organization_id and customer_id are required.");
      const created = await supabase.from("crm_tasks").insert({
        organization_id: organizationId,
        customer_id: customerId,
        lead_id: leadId,
        assigned_agent_id: agentId,
        task_type: "sales_follow_up",
        title: text(args.title) || "Leo prepared follow-up",
        description: text(args.message) || text(args.description) || "Follow-up prepared by Leo.",
        status: "pending",
        due_at: text(args.due_at) || null,
        metadata: { source: "leo_core_v2", channel: text(args.channel) || input.identity.channel },
      }).select("id,status,due_at").single();
      if (created.error) throw created.error;
      return { prepared: true, task: created.data };
    }
    case "leo.crm.followup.send": return delegateFollowUp(input.identity, args);
    case "leo.campaign.prepare": return { prepared: true, draft: args, note: "Campaign prepared. Sending still requires the configured campaign executor." };
    case "leo.campaign.send": {
      const url = text(process.env.LEO_CAMPAIGN_EXECUTOR_WEBHOOK_URL);
      if (!url) throw new Error("Leo campaign executor is not configured yet.");
      const organizationId = input.identity.scope === "tenant" ? tenantOrganization(input.identity, args) : text(args.organization_id) || undefined;
      return callWorkflow(url, { ...args, organization_id: organizationId, requested_by_leo: true, channel: input.identity.channel });
    }
    case "leo.appointment.read": {
      const organizationId = tenantOrganization(input.identity, args);
      if (!organizationId) throw new Error("Organization is required.");
      const result = await supabase.from("crm_tasks").select("id,customer_id,lead_id,assigned_agent_id,title,description,status,due_at,metadata,created_at,updated_at").eq("organization_id", organizationId).eq("task_type", "appointment").order("due_at", { ascending: true }).limit(Math.max(1, Math.min(100, Number(args.limit) || 30)));
      if (result.error) throw result.error;
      return { organization_id: organizationId, appointments: result.data || [] };
    }
    case "leo.appointment.manage": return delegateAppointment(input.identity, args);
    case "leo.agent.pause":
    case "leo.agent.resume": {
      const organizationId = tenantOrganization(input.identity, args);
      const agentId = text(args.agent_id);
      if (!organizationId || !agentId) throw new Error("organization_id and agent_id are required.");
      const status = tool.key === "leo.agent.pause" ? "paused" : text(args.resume_status) || "testing";
      const result = await supabase.from("agents").update({ status, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("id", agentId).select("id,name,status").single();
      if (result.error) throw result.error;
      return { agent: result.data, verified: result.data.status === status };
    }
    case "leo.support.request_admin_repair": {
      const organizationId = tenantOrganization(input.identity, args);
      if (!organizationId) throw new Error("Organization is required.");
      const conversation = await supabase.from("support_conversations").insert({ organization_id: organizationId, title: text(args.title) || "Leo admin repair request", status: "waiting_approval", priority: text(args.priority) || "normal", created_by: input.actor, assigned_agent: "agent-leo", metadata: { source: "leo_core_v2" } }).select("id").single();
      if (conversation.error) throw conversation.error;
      const action = await supabase.from("support_actions").insert({ conversation_id: conversation.data.id, organization_id: organizationId, action_key: "request_admin_repair", title: text(args.title) || "Admin repair requested", description: text(args.description) || "Tenant requested platform admin review through Leo.", risk_level: "medium", status: "proposed", payload: { source: "leo_core_v2", details: args } }).select("id,status").single();
      if (action.error) throw action.error;
      return { requested: true, conversation_id: conversation.data.id, action: action.data };
    }
    case "leo.platform.organizations.read": {
      const result = await supabase.from("organizations").select("id,name,slug,status,created_at,updated_at").order("created_at", { ascending: false }).limit(Math.max(1, Math.min(200, Number(args.limit) || 50)));
      if (result.error) throw result.error;
      return { organizations: result.data || [] };
    }
    case "leo.platform.tenant.pause":
    case "leo.platform.tenant.resume": {
      const organizationId = text(args.organization_id);
      if (!organizationId) throw new Error("organization_id is required.");
      const status = tool.key === "leo.platform.tenant.pause" ? "suspended" : "active";
      const result = await supabase.from("organizations").update({ status, updated_at: new Date().toISOString() }).eq("id", organizationId).select("id,name,status").single();
      if (result.error) throw result.error;
      return { organization: result.data, verified: result.data.status === status };
    }
    case "leo.platform.workflow.activate":
    case "leo.platform.workflow.deactivate": {
      const registryId = text(args.workflow_registry_id);
      if (!registryId) throw new Error("workflow_registry_id is required.");
      const registry = await supabase.from("workflow_registry").select("id,external_workflow_id,status").eq("id", registryId).maybeSingle();
      if (registry.error || !registry.data) throw registry.error || new Error("Workflow registry record not found.");
      const workflowId = text(args.n8n_workflow_id) || text(registry.data.external_workflow_id);
      if (!workflowId) throw new Error("No n8n workflow ID is mapped to this registry record.");
      const state = tool.key === "leo.platform.workflow.activate" ? await activateN8nWorkflow(workflowId) : await deactivateN8nWorkflow(workflowId);
      const status = tool.key === "leo.platform.workflow.activate" ? "active" : "paused";
      const updated = await supabase.from("workflow_registry").update({ status, updated_at: new Date().toISOString() }).eq("id", registryId).select("id,status").single();
      if (updated.error) throw updated.error;
      return { registry: updated.data, n8n: state, verified: Boolean((state as { active?: boolean }).active) === (status === "active") };
    }
    case "leo.platform.workflow.resync": return tenantSnapshot({ ...input.identity, scope: "super_admin", globalScope: true }, args);
    default: throw new Error(`Leo tool ${tool.key} does not yet have an executor implementation.`);
  }
}
