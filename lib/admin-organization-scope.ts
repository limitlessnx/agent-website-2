import { getAdminOrganizationContext, type SystemOrganizationId } from "@/lib/admin-organization-context";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminOrganizationScope = {
  kind: "system" | "tenant";
  contextId: string;
  systemId?: SystemOrganizationId;
  organizationId: string;
  name: string;
  slug: string;
  status: string;
  workflowLegacyIds: string[];
};

const SYSTEM_SLUGS: Record<SystemOrganizationId, string> = {
  fluxknight: "fluxknight",
  "limitless-realty": "limitless-realty",
  gencouv: "gencouv",
};

function workflowLegacyIds(systemId?: SystemOrganizationId) {
  if (systemId === "limitless-realty") return ["limitless-realty"];
  if (systemId === "gencouv") return ["gencouv"];
  if (systemId === "fluxknight") return ["fluxknight", "platform", "leo"];
  return [];
}

export async function resolveAdminOrganizationScope(): Promise<AdminOrganizationScope> {
  const context = await getAdminOrganizationContext();
  const unavailable = (name: string, slug: string, systemId?: SystemOrganizationId): AdminOrganizationScope => ({
    kind: context.kind,
    contextId: context.id,
    systemId,
    organizationId: `unavailable:${context.kind}:${context.id}`,
    name,
    slug,
    status: "unavailable",
    workflowLegacyIds: workflowLegacyIds(systemId),
  });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    const systemId = context.kind === "system" ? context.id : undefined;
    return unavailable(context.kind === "system" ? context.name : "Tenant organization", systemId ? SYSTEM_SLUGS[systemId] : context.id, systemId);
  }

  if (context.kind === "tenant") {
    const { data, error } = await admin
      .from("organizations")
      .select("id,name,slug,status")
      .eq("id", context.id)
      .maybeSingle();

    if (!error && data) {
      return {
        kind: "tenant",
        contextId: context.id,
        organizationId: String(data.id),
        name: String(data.name || "Tenant organization"),
        slug: String(data.slug || context.id),
        status: String(data.status || "active"),
        workflowLegacyIds: [],
      };
    }
  }

  const systemId = context.kind === "system" ? context.id : "fluxknight";
  const slug = SYSTEM_SLUGS[systemId] || "fluxknight";
  const { data, error } = await admin
    .from("organizations")
    .select("id,name,slug,status")
    .eq("slug", slug)
    .maybeSingle();

  if (!error && data) {
    return {
      kind: "system",
      contextId: systemId,
      systemId,
      organizationId: String(data.id),
      name: String(data.name || (context.kind === "system" ? context.name : "Fluxknight")),
      slug: String(data.slug || slug),
      status: String(data.status || "active"),
      workflowLegacyIds: workflowLegacyIds(systemId),
    };
  }

  const fallback = await admin
    .from("organizations")
    .select("id,name,slug,status")
    .eq("slug", "fluxknight")
    .maybeSingle();

  if (fallback.data) {
    return {
      kind: "system",
      contextId: "fluxknight",
      systemId: "fluxknight",
      organizationId: String(fallback.data.id),
      name: String(fallback.data.name || "Fluxknight"),
      slug: String(fallback.data.slug || "fluxknight"),
      status: String(fallback.data.status || "active"),
      workflowLegacyIds: workflowLegacyIds("fluxknight"),
    };
  }

  const requestedSystemId = context.kind === "system" ? context.id : undefined;
  return unavailable(
    context.kind === "system" ? context.name : "Tenant organization",
    requestedSystemId ? SYSTEM_SLUGS[requestedSystemId] : context.id,
    requestedSystemId,
  );
}

export function organizationHomeHref(scope: Pick<AdminOrganizationScope, "kind" | "systemId">) {
  if (scope.kind === "system" && scope.systemId === "limitless-realty") return "/dashboard/limitless/leads";
  if (scope.kind === "system" && scope.systemId === "gencouv") return "/dashboard/gencouv";
  return "/dashboard";
}
