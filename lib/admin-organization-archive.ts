import { randomUUID } from "node:crypto";
import type { AdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrganizationId, organizationCategory } from "@/lib/organization-context-catalog";

export class OrganizationArchiveError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
/** The caller authenticates a platform admin. This retains all customer and membership records. */
export async function archiveAdminOrganization(session: AdminSession, organizationId: string, input: { confirmation?: unknown; reason?: unknown }) {
  if (!isOrganizationId(organizationId)) throw new OrganizationArchiveError("Invalid organization.", 400);
  const admin = createAdminClient();
  const result = await admin.from("organizations").select("id,name,slug,status").eq("id", organizationId).maybeSingle();
  if (result.error) throw new OrganizationArchiveError("Organization could not be verified.", 503);
  const organization = result.data;
  if (!organization) throw new OrganizationArchiveError("Organization not found.", 404);
  if (organizationCategory(organization.slug) !== "customer") throw new OrganizationArchiveError("Platform and internal system organizations cannot be deleted here.", 403);
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (input.confirmation !== organization.name || !reason || reason.length > 500) throw new OrganizationArchiveError("Enter the exact organization name and a reason (up to 500 characters).", 400);
  if (organization.status === "archived") return { archived: true, alreadyArchived: true, auditWarning: false };
  const id = randomUUID();
  const metadata = { actor_email: session.email, auth_mode: session.authMode || "legacy", previous_status: organization.status, outcome: "requested", data_retained: true };
  const intent = await admin.from("audit_logs").insert({ id, organization_id: organizationId, actor_user_id: session.authMode === "account" ? session.userId : null, action: "admin.organization.archive", resource_type: "organization", resource_id: organizationId, reason, metadata });
  if (intent.error) throw new OrganizationArchiveError("The action could not be logged. Organization was not changed.", 503);
  const changed = await admin.from("organizations").update({ status: "archived" }).eq("id", organizationId).eq("slug", organization.slug).eq("name", organization.name).eq("status", organization.status).select("id").maybeSingle();
  const outcome = changed.error ? "unconfirmed" : changed.data ? "archived" : "conflict";
  let auditWarning = true;
  try {
    const audit = await admin.from("audit_logs").update({ metadata: { ...metadata, outcome } }).eq("id", id).eq("organization_id", organizationId);
    auditWarning = Boolean(audit.error);
  } catch { /* The intent exists; preserve the confirmed archive outcome. */ }
  if (outcome !== "archived") throw new OrganizationArchiveError("Archiving was not confirmed. Refresh the organization before retrying.", changed.error ? 503 : 409);
  return { archived: true, alreadyArchived: false, auditWarning };
}
