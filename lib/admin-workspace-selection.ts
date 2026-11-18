import type { AdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrganizationId, SYSTEM_ORGANIZATIONS } from "@/lib/organization-context-catalog";

export class WorkspaceSelectionError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Caller must authenticate a platform admin. Selection never creates tenant membership. */
export async function authorizeWorkspaceSelection(session: AdminSession, input: { kind?: unknown; id?: unknown }): Promise<{ kind: "system" | "tenant"; id: string }> {
  const kind = input.kind;
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if ((kind !== "system" && kind !== "tenant") || !id ||
      (kind === "tenant" ? !isOrganizationId(id) : !SYSTEM_ORGANIZATIONS.some(item => item.id === id))) {
    throw new WorkspaceSelectionError("Choose a valid organization.", 400);
  }
  const admin = createAdminClient();
  const result = await admin.from("organizations").select("id,name,slug,status")
    .eq(kind === "tenant" ? "id" : "slug", id).maybeSingle();
  if (result.error) throw new WorkspaceSelectionError("Workspace could not be verified. Try again.", 503);
  const outcome = kind === "tenant" && !result.data ? "not_found" : "selected";
  const audit = await admin.from("audit_logs").insert({
    organization_id: result.data?.id || null,
    actor_user_id: session.authMode === "account" ? session.userId : null,
    action: "admin.workspace.select", resource_type: "organization", resource_id: result.data?.id || id,
    metadata: { actor_email: session.email, auth_mode: session.authMode || "legacy", context_kind: kind, context_id: id, outcome },
  });
  if (audit.error) throw new WorkspaceSelectionError("Workspace selection could not be logged. Try again.", 503);
  if (outcome === "not_found") throw new WorkspaceSelectionError("Organization not found.", 404);
  return { kind, id };
}
