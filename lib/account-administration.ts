import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type AccountLifecycleStatus = "active" | "suspended" | "archived";

export type AccountLifecycleMetadata = {
  cancellation_requested_at?: string;
  cancellation_reason?: string;
  cancellation_requested_by?: string;
  ownership_transfer_requested_at?: string;
  ownership_transfer_target_email?: string;
  ownership_transfer_requested_by?: string;
  last_account_action?: string;
  last_account_action_at?: string;
};

export type AccountAdministrationSnapshot = {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: AccountLifecycleStatus;
    metadata: Record<string, unknown>;
  };
  members: Array<{
    id: string;
    user_id: string;
    status: string;
    created_at: string;
    role: string;
  }>;
  lifecycle: AccountLifecycleMetadata;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: AccountLifecycleStatus;
  metadata?: Record<string, unknown> | null;
};

type MembershipRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  membership_roles?: Array<{ roles?: { slug?: string } | Array<{ slug?: string }> | null }>;
};

function relationSlug(value: MembershipRow["membership_roles"]) {
  const roles = value || [];
  const relation = roles[0]?.roles;
  if (Array.isArray(relation)) return relation[0]?.slug || "member";
  return relation?.slug || "member";
}

function lifecycleFromMetadata(metadata: Record<string, unknown>): AccountLifecycleMetadata {
  const raw = (metadata.account_lifecycle || {}) as Record<string, unknown>;
  return {
    cancellation_requested_at: typeof raw.cancellation_requested_at === "string" ? raw.cancellation_requested_at : undefined,
    cancellation_reason: typeof raw.cancellation_reason === "string" ? raw.cancellation_reason : undefined,
    cancellation_requested_by: typeof raw.cancellation_requested_by === "string" ? raw.cancellation_requested_by : undefined,
    ownership_transfer_requested_at: typeof raw.ownership_transfer_requested_at === "string" ? raw.ownership_transfer_requested_at : undefined,
    ownership_transfer_target_email: typeof raw.ownership_transfer_target_email === "string" ? raw.ownership_transfer_target_email : undefined,
    ownership_transfer_requested_by: typeof raw.ownership_transfer_requested_by === "string" ? raw.ownership_transfer_requested_by : undefined,
    last_account_action: typeof raw.last_account_action === "string" ? raw.last_account_action : undefined,
    last_account_action_at: typeof raw.last_account_action_at === "string" ? raw.last_account_action_at : undefined,
  };
}

export async function getAccountAdministrationSnapshot(organizationId: string): Promise<AccountAdministrationSnapshot | null> {
  const [organizations, memberships] = await Promise.all([
    supabaseServerRequest<OrganizationRow[]>(`organizations?id=eq.${encodeURIComponent(organizationId)}&select=id,name,slug,status,metadata&limit=1`),
    supabaseServerRequest<MembershipRow[]>(`organization_memberships?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,user_id,status,created_at,membership_roles(roles(slug))&order=created_at.asc`),
  ]);
  const organization = organizations[0];
  if (!organization) return null;
  const metadata = organization.metadata || {};
  return {
    organization: { ...organization, metadata },
    members: memberships.map((membership) => ({
      id: membership.id,
      user_id: membership.user_id,
      status: membership.status,
      created_at: membership.created_at,
      role: relationSlug(membership.membership_roles),
    })),
    lifecycle: lifecycleFromMetadata(metadata),
  };
}
