import { getOrganizationAccessContext } from "@/lib/organization-membership";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { ClientSession } from "@/lib/client-auth";

type SystemRow = {
  status: string;
  system_catalog?: { slug?: string } | Array<{ slug?: string }> | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function getPortalCapabilities(session: ClientSession) {
  const access = await getOrganizationAccessContext(session.organizationId, session.userId);
  const systems = await supabaseServerRequest<SystemRow[]>(
    `organization_systems?organization_id=eq.${encodeURIComponent(session.organizationId)}&status=neq.archived&select=status,system_catalog(slug)`,
  ).catch(() => []);

  const installedSystems = new Set(
    systems.map((row) => one(row.system_catalog)?.slug || "").filter(Boolean),
  );
  const permissions = access.permissions;
  const hasAny = (...keys: string[]) => keys.some((key) => permissions.has(key));

  return {
    role: access.roles[0] || session.role,
    permissions: [...permissions],
    installedSystems: [...installedSystems],
    customers: hasAny("customers.view", "customers.manage"),
    conversations: hasAny("conversations.view", "conversations.reply"),
    systems: hasAny("systems.view", "systems.manage"),
    appointments: hasAny("appointments.view", "appointments.manage") && installedSystems.has("appointment-system"),
    analytics: permissions.has("analytics.view"),
    team: hasAny("members.view", "members.manage", "members.invite"),
    integrations: hasAny("integrations.view", "integrations.manage"),
    billing: hasAny("billing.view", "billing.manage"),
    support: permissions.has("support.escalate") || access.roles.includes("owner"),
  };
}

export async function requirePortalPermission(session: ClientSession, keys: string[]) {
  const access = await getOrganizationAccessContext(session.organizationId, session.userId);
  if (!keys.some((key) => access.permissions.has(key))) {
    throw new Error("Portal permission denied.");
  }
  return access;
}
