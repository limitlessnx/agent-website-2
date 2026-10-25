import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession } from "@/lib/client-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type XposureAppointmentAuthorization =
  | { ok: true; organizationId: string; actorUserId: string | null; authMode: "platform-admin" | "organization-member" }
  | { ok: false; response: NextResponse };

function denied(message: string, status: number): XposureAppointmentAuthorization {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

/**
 * Authorizes Xposure appointment administration through an active organization
 * membership with appointments.manage, or the existing platform-admin session.
 * An organization context by itself is never sufficient.
 */
export async function authorizeXposureAppointmentManagement(): Promise<XposureAppointmentAuthorization> {
  const session = await getClientSession().catch(() => null);
  if (session) {
    try {
      const organizations = await supabaseServerRequest<Array<{ id: string; slug: string; status: string }>>(
        `organizations?id=eq.${encodeURIComponent(session.organizationId)}&select=id,slug,status&limit=1`,
      );
      const organization = organizations[0];
      if (!organization || organization.status !== "active" || organization.slug !== "xposure") {
        return denied("An active Xposure organization membership is required.", 403);
      }
      await requirePortalPermission(session, ["appointments.manage"]);
      return {
        ok: true,
        organizationId: organization.id,
        actorUserId: session.userId,
        authMode: "organization-member",
      };
    } catch (error) {
      return denied(error instanceof Error && error.message.toLowerCase().includes("permission")
        ? "You do not have permission to manage studio appointments."
        : "Unable to verify organization permissions.", 403);
    }
  }

  if (!(await getAdminSession())) return denied("Authentication required.", 401);
  const scope = await resolveAdminOrganizationScope();
  if (scope.status !== "active" || scope.organizationId.startsWith("unavailable:")) {
    return denied("Active organization context is required.", 403);
  }
  if (scope.kind !== "tenant" || scope.slug !== "xposure") {
    return denied("Switch to the Xposure organization before managing studio appointments.", 403);
  }
  return { ok: true, organizationId: scope.organizationId, actorUserId: null, authMode: "platform-admin" };
}
