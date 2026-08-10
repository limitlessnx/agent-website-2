import type { ClientSession } from "@/lib/client-auth";
import {
  canonicalLeoToolKey,
  isLeoToolAllowed,
  leoApprovalFor,
  type LeoIdentity,
  type LeoRole,
} from "@/lib/leo-core";

function normalizeLegacyTenantRole(role: string): LeoRole {
  const value = String(role || "member").trim().toLowerCase().replaceAll("-", "_");
  if (["owner", "organization_owner"].includes(value)) return "owner";
  if (["admin", "tenant_admin", "organization_admin"].includes(value)) return "tenant_admin";
  if (["manager", "supervisor"].includes(value)) return "manager";
  if (["staff", "agent", "operator"].includes(value)) return "staff";
  if (["viewer", "read_only", "readonly"].includes(value)) return "viewer";
  return "member";
}

export function tenantLeoIdentityFromSession(session: ClientSession): LeoIdentity {
  return {
    scope: "tenant",
    role: normalizeLegacyTenantRole(session.role),
    userId: session.userId,
    email: session.email,
    organizationId: session.organizationId,
    organizationSlug: session.organizationSlug,
    membershipId: session.membershipId,
    channel: "chat",
    globalScope: false,
  };
}

export function legacySupportActionPolicy(identity: LeoIdentity, actionKey: string) {
  const canonicalKey = canonicalLeoToolKey(actionKey);
  if (!canonicalKey || !isLeoToolAllowed(identity, canonicalKey)) return null;
  return {
    canonicalKey,
    approval: leoApprovalFor(identity, canonicalKey),
  };
}
