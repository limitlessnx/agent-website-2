import { getIndustryExperience } from "@/lib/industryExperience";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession } from "@/lib/client-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type XposureTenantPermission =
  | "systems.view"
  | "systems.manage"
  | "customers.view"
  | "customers.manage"
  | "workflows.read"
  | "workflows.manage";

export type XposureTenantAuthorization =
  | { ok: true; organizationId: string; actorUserId: string | null; authMode: "platform-admin" | "organization-member" }
  | { ok: false; response: NextResponse };

export function isPhotographyOrganization(organization: { slug: string; status: string; metadata?: Record<string, unknown> | null }) {
  if (organization.status !== "active") return false;
  if (organization.slug === "xposure") return true;
  return getIndustryExperience(String(organization.metadata?.industry_slug || organization.metadata?.industry || "")).slug === "photography-studio";
}

function denied(message: string, status: number): XposureTenantAuthorization {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/**
 * Authorizes Xposure catalogue, contact, and reminder APIs for an active
 * organization member with the requested permission, or a scoped platform
 * admin. Tenant context alone never grants organization-member access.
 */
export async function authorizeXposureTenantAccess(
  permission: XposureTenantPermission,
): Promise<XposureTenantAuthorization> {
  const session = await getClientSession().catch(() => null);
  if (session) {
    try {
      const organizations = await supabaseServerRequest<Array<{ id: string; slug: string; status: string; metadata?: Record<string, unknown> | null }>>(
        `organizations?id=eq.${encodeURIComponent(session.organizationId)}&select=id,slug,status,metadata&limit=1`,
      );
      const organization = organizations[0];
      if (!organization || organization.status !== "active" || !isPhotographyOrganization(organization)) {
        return denied("An active Photography organization membership is required.", 403);
      }
      await requirePortalPermission(session, [permission]);
      return {
        ok: true,
        organizationId: organization.id,
        actorUserId: session.userId,
        authMode: "organization-member",
      };
    } catch (error) {
      return denied(
        error instanceof Error && error.message.toLowerCase().includes("permission")
          ? "You do not have permission to perform this action in this studio."
          : "Unable to verify organization permissions.",
        403,
      );
    }
  }

  if (!(await getAdminSession())) return denied("Authentication required.", 401);
  const scope = await resolveAdminOrganizationScope();
  if (scope.status !== "active" || scope.organizationId.startsWith("unavailable:")) {
    return denied("Active organization context is required.", 403);
  }
  if (scope.kind !== "tenant") return denied("Switch to a Photography tenant before managing studio data.", 403);
  const organizations = await supabaseServerRequest<Array<{ id: string; slug: string; status: string; metadata?: Record<string, unknown> | null }>>(
    `organizations?id=eq.${encodeURIComponent(scope.organizationId)}&select=id,slug,status,metadata&limit=1`,
  ).catch(() => []);
  if (!organizations[0] || !isPhotographyOrganization(organizations[0])) {
    return denied("An active Photography organization is required.", 403);
  }
  return { ok: true, organizationId: scope.organizationId, actorUserId: null, authMode: "platform-admin" };
}
