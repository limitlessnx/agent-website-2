import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession, type ClientSession } from "@/lib/client-auth";

export type LeoScope = "public" | "tenant" | "super_admin" | "internal_service";
export type LeoConversationVisibility = "private" | "team" | "organization";
export type LeoRole =
  | "visitor"
  | "viewer"
  | "member"
  | "staff"
  | "manager"
  | "owner"
  | "tenant_admin"
  | "super_admin"
  | "service";

export type LeoChannel = "chat" | "voice" | "api";
export type LeoApprovalMode = "none" | "confirm" | "admin";

export type LeoIdentity = {
  scope: LeoScope;
  role: LeoRole;
  userId?: string;
  email?: string;
  organizationId?: string;
  organizationSlug?: string;
  membershipId?: string;
  channel: LeoChannel;
  globalScope: boolean;
};

export type LeoToolDefinition = {
  key: string;
  title: string;
  description: string;
  scopes: LeoScope[];
  minimumTenantRole?: LeoRole;
  readOnly: boolean;
  approval: LeoApprovalMode;
  sensitive?: boolean;
  legacyAliases?: string[];
};

const TENANT_ROLE_ORDER: LeoRole[] = [
  "visitor",
  "viewer",
  "member",
  "staff",
  "manager",
  "owner",
  "tenant_admin",
  "super_admin",
];

export const LEO_TOOLS: LeoToolDefinition[] = [
  {
    key: "leo.public.services.read",
    title: "Read Fluxknight services",
    description: "Explain public Fluxknight services and capabilities.",
    scopes: ["public", "tenant", "super_admin"],
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.public.industries.read",
    title: "Read Fluxknight industries",
    description: "Explain public industry solutions and common use cases.",
    scopes: ["public", "tenant", "super_admin"],
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.public.pricing.read",
    title: "Read Fluxknight pricing",
    description: "Explain currently approved public plans and pricing.",
    scopes: ["public", "tenant", "super_admin"],
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.public.plan.recommend",
    title: "Recommend a plan",
    description: "Recommend a Fluxknight plan from supplied public business requirements.",
    scopes: ["public", "tenant", "super_admin"],
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.public.lead.capture",
    title: "Capture public lead",
    description: "Create a public sales lead after the visitor supplies contact details.",
    scopes: ["public", "super_admin"],
    readOnly: false,
    approval: "none",
  },
  {
    key: "leo.public.demo.book",
    title: "Book evaluation",
    description: "Create an evaluation or demo request from a qualified public visitor.",
    scopes: ["public", "super_admin"],
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.tenant.inspect",
    title: "Inspect tenant workspace",
    description: "Read safe workspace health, agents, integrations, workflows and recent runtime information for the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
    legacyAliases: ["inspect_tenant"],
  },
  {
    key: "leo.agent.inspect",
    title: "Inspect agent",
    description: "Read configuration and runtime state for an agent in the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
    legacyAliases: ["inspect_agent", "review_agent_configuration"],
  },
  {
    key: "leo.workflow.inspect",
    title: "Inspect workflow",
    description: "Read workflow state within the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
    legacyAliases: ["inspect_workflow"],
  },
  {
    key: "leo.workflow.inspect_failures",
    title: "Inspect workflow failures",
    description: "Inspect recent workflow failures and safe error summaries.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
    legacyAliases: ["inspect_workflow_failures", "inspect_tenant_workflow_failures", "review_runtime_errors"],
  },
  {
    key: "leo.integration.inspect",
    title: "Inspect integrations",
    description: "Read safe connection health for the current organization without revealing credentials.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
    sensitive: true,
    legacyAliases: ["verify_tenant_integrations"],
  },
  {
    key: "leo.billing.inspect",
    title: "Inspect subscription",
    description: "Read the current organization's plan and subscription status.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
    legacyAliases: ["review_subscription_status"],
  },
  {
    key: "leo.crm.leads.read",
    title: "Read leads",
    description: "Search leads belonging to the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.crm.leads.update",
    title: "Update lead",
    description: "Update permitted lead fields inside the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "staff",
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.crm.followup.prepare",
    title: "Prepare follow-up",
    description: "Prepare a tenant-scoped follow-up without sending it.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "staff",
    readOnly: false,
    approval: "none",
  },
  {
    key: "leo.crm.followup.send",
    title: "Send follow-up",
    description: "Send an approved follow-up using the current organization's configured channel.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "manager",
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.campaign.prepare",
    title: "Prepare campaign",
    description: "Create a campaign draft and recipient preview inside the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "staff",
    readOnly: false,
    approval: "none",
  },
  {
    key: "leo.campaign.send",
    title: "Send campaign",
    description: "Send an approved campaign to tenant-scoped recipients.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "manager",
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.appointment.read",
    title: "Read appointments",
    description: "Read appointments in the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "viewer",
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.appointment.manage",
    title: "Manage appointments",
    description: "Create, reschedule or cancel appointments inside the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "staff",
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.agent.pause",
    title: "Pause agent",
    description: "Pause an agent in the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "owner",
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["pause_agent"],
  },
  {
    key: "leo.agent.resume",
    title: "Resume agent",
    description: "Resume an agent in the current organization.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "owner",
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["resume_agent"],
  },
  {
    key: "leo.support.request_admin_repair",
    title: "Request admin repair",
    description: "Escalate a tenant-scoped production repair request to Fluxknight administration.",
    scopes: ["tenant", "super_admin"],
    minimumTenantRole: "manager",
    readOnly: false,
    approval: "admin",
    legacyAliases: ["request_admin_repair"],
  },
  {
    key: "leo.limitless.leads.read",
    title: "Search Limitless Realty leads",
    description: "Search the owned Limitless Realty CRM by lead ID, name, phone or email. Use this for requests such as pull up or find a Limitless Realty lead.",
    scopes: ["super_admin"],
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.limitless.followup.prepare",
    title: "Prepare Limitless Realty follow-up",
    description: "Prepare one Limitless Realty WhatsApp follow-up using the proven limitless_realty_update_v2 Meta template. Arguments should identify one lead and include either message/update/content or property_id. This never sends.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "none",
  },
  {
    key: "leo.limitless.followup.send",
    title: "Send Limitless Realty follow-up",
    description: "Send one approved Limitless Realty WhatsApp follow-up through the existing proven campaign workflow and authoritative limitless_realty_update_v2 template. Arguments must identify one lead and include either message/update/content or property_id.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.limitless.campaign.prepare",
    title: "Prepare Limitless Realty update campaign",
    description: "Preview an all-eligible-leads Limitless Realty WhatsApp update using the authoritative limitless_realty_update_v2 template, including recipient counts and cooldown exclusions. Include either message/update/content or property_id. This never sends.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "none",
  },
  {
    key: "leo.limitless.campaign.send",
    title: "Send Limitless Realty update campaign",
    description: "Send an approved Limitless Realty update to all currently eligible leads through the existing proven WhatsApp campaign workflow using the authoritative limitless_realty_update_v2 template. Include either message/update/content or property_id. Always require confirmation before sending.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
  },
  {
    key: "leo.platform.organizations.read",
    title: "Read organizations",
    description: "Inspect organizations across Fluxknight.",
    scopes: ["super_admin"],
    readOnly: true,
    approval: "none",
  },
  {
    key: "leo.platform.tenant.pause",
    title: "Pause tenant",
    description: "Suspend a tenant organization at platform level.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["pause_tenant"],
  },
  {
    key: "leo.platform.tenant.resume",
    title: "Resume tenant",
    description: "Resume a suspended tenant organization.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["resume_tenant"],
  },
  {
    key: "leo.platform.workflow.activate",
    title: "Activate workflow",
    description: "Activate a mapped production workflow.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["activate_workflow"],
  },
  {
    key: "leo.platform.workflow.deactivate",
    title: "Deactivate workflow",
    description: "Deactivate a mapped production workflow.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["deactivate_workflow"],
  },
  {
    key: "leo.platform.workflow.resync",
    title: "Resync workflow registry",
    description: "Read and resync platform workflow registry information.",
    scopes: ["super_admin"],
    readOnly: false,
    approval: "confirm",
    legacyAliases: ["resync_workflow_registry", "retry_failed_execution"],
  },
];

const TOOL_LOOKUP = new Map<string, LeoToolDefinition>();
for (const tool of LEO_TOOLS) {
  TOOL_LOOKUP.set(tool.key, tool);
  for (const alias of tool.legacyAliases || []) TOOL_LOOKUP.set(alias, tool);
}

function normalizeTenantRole(role: string | undefined): LeoRole {
  const value = String(role || "member").trim().toLowerCase().replaceAll("-", "_");
  if (["owner", "organization_owner"].includes(value)) return "owner";
  if (["admin", "tenant_admin", "organization_admin"].includes(value)) return "tenant_admin";
  if (["manager", "supervisor"].includes(value)) return "manager";
  if (["staff", "agent", "operator"].includes(value)) return "staff";
  if (["viewer", "read_only", "readonly"].includes(value)) return "viewer";
  return "member";
}

function tenantRoleAtLeast(actual: LeoRole, minimum: LeoRole) {
  return TENANT_ROLE_ORDER.indexOf(actual) >= TENANT_ROLE_ORDER.indexOf(minimum);
}

function identityFromClient(session: ClientSession, channel: LeoChannel): LeoIdentity {
  return {
    scope: "tenant",
    role: normalizeTenantRole(session.role),
    userId: session.userId,
    email: session.email,
    organizationId: session.organizationId,
    organizationSlug: session.organizationSlug,
    membershipId: session.membershipId,
    channel,
    globalScope: false,
  };
}

export async function resolveLeoIdentity(input: { channel?: LeoChannel; allowPublic?: boolean } = {}): Promise<LeoIdentity | null> {
  const channel = input.channel || "chat";
  const admin = await getAdminSession();
  if (admin) {
    return {
      scope: "super_admin",
      role: "super_admin",
      email: admin.email,
      channel,
      globalScope: true,
    };
  }

  const client = await getClientSession();
  if (client) return identityFromClient(client, channel);

  if (input.allowPublic) {
    return {
      scope: "public",
      role: "visitor",
      channel,
      globalScope: false,
    };
  }

  return null;
}

export function resolveLeoTool(keyOrAlias: string) {
  return TOOL_LOOKUP.get(String(keyOrAlias || "").trim()) || null;
}

export function canonicalLeoToolKey(keyOrAlias: string) {
  return resolveLeoTool(keyOrAlias)?.key || null;
}

export function isLeoToolAllowed(identity: LeoIdentity, keyOrAlias: string) {
  const tool = resolveLeoTool(keyOrAlias);
  if (!tool) return false;
  if (!tool.scopes.includes(identity.scope)) return false;
  if (identity.scope === "tenant" && tool.minimumTenantRole) {
    return tenantRoleAtLeast(identity.role, tool.minimumTenantRole);
  }
  return true;
}

export function assertLeoToolAllowed(identity: LeoIdentity, keyOrAlias: string) {
  const tool = resolveLeoTool(keyOrAlias);
  if (!tool) throw new Error(`Unknown Leo tool: ${keyOrAlias}`);
  if (!isLeoToolAllowed(identity, keyOrAlias)) {
    throw new Error(`Leo tool ${tool.key} is not permitted for ${identity.scope}/${identity.role}.`);
  }
  return tool;
}

export function listLeoToolsForIdentity(identity: LeoIdentity) {
  return LEO_TOOLS.filter((tool) => isLeoToolAllowed(identity, tool.key));
}

export function leoApprovalFor(identity: LeoIdentity, keyOrAlias: string): LeoApprovalMode {
  return assertLeoToolAllowed(identity, keyOrAlias).approval;
}

export function enforceLeoOrganizationScope(identity: LeoIdentity, requestedOrganizationId?: string | null) {
  if (identity.scope === "super_admin") return requestedOrganizationId || undefined;
  if (identity.scope !== "tenant") return undefined;
  if (!identity.organizationId) throw new Error("Tenant Leo identity has no organization scope.");
  if (requestedOrganizationId && requestedOrganizationId !== identity.organizationId) {
    throw new Error("Cross-tenant Leo access was blocked.");
  }
  return identity.organizationId;
}

function safePageValue(value: unknown, max = 180) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/https?:\/\/\S+/gi, "[url]").trim();
  return cleaned ? cleaned.slice(0, max) : undefined;
}

export function sanitizeLeoPageContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  return {
    pathname: safePageValue(input.pathname, 240),
    section: safePageValue(input.section),
    resourceType: safePageValue(input.resourceType),
    resourceId: safePageValue(input.resourceId),
    resourceLabel: safePageValue(input.resourceLabel),
  };
}

export function buildLeoPolicySnapshot(identity: LeoIdentity) {
  const tools = listLeoToolsForIdentity(identity);
  return {
    scope: identity.scope,
    role: identity.role,
    organizationId: identity.scope === "tenant" ? identity.organizationId || null : null,
    globalScope: identity.globalScope,
    channel: identity.channel,
    toolCount: tools.length,
    tools: tools.map((tool) => ({
      key: tool.key,
      readOnly: tool.readOnly,
      approval: tool.approval,
    })),
  };
}
