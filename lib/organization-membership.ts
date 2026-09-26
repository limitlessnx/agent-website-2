import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type PermissionRelation = { key?: string } | Array<{ key?: string }> | null;
type RolePermissionRow = { permissions?: PermissionRelation };
type RoleRelation = {
  id?: string;
  slug?: string;
  name?: string;
  role_permissions?: RolePermissionRow[];
} | Array<{
  id?: string;
  slug?: string;
  name?: string;
  role_permissions?: RolePermissionRow[];
}> | null;

type MembershipRoleRow = { roles?: RoleRelation };
type MembershipAccessRow = {
  id: string;
  user_id: string;
  status: string;
  membership_roles?: MembershipRoleRow[];
};

type InvitationRow = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  invited_by?: string | null;
  roles?: { slug?: string; name?: string } | Array<{ slug?: string; name?: string }> | null;
};

type MemberListRow = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  membership_roles?: MembershipRoleRow[];
};

function normalizeOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function permissionsFromMembership(row: MembershipAccessRow) {
  const keys = new Set<string>();
  for (const membershipRole of row.membership_roles || []) {
    const role = normalizeOne(membershipRole.roles);
    for (const rp of role?.role_permissions || []) {
      const permission = normalizeOne(rp.permissions);
      if (permission?.key) keys.add(permission.key);
    }
  }
  return keys;
}

export async function getOrganizationAccessContext(organizationId: string, userId: string) {
  const rows = await supabaseServerRequest<MembershipAccessRow[]>(
    `organization_memberships?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id,user_id,status,membership_roles(roles(id,slug,name,role_permissions(permissions(key))))&limit=1`,
  );
  const membership = rows[0];
  if (!membership) throw new Error("Active organization membership required.");

  const roles = (membership.membership_roles || [])
    .map((item) => normalizeOne(item.roles)?.slug || "")
    .filter(Boolean);
  const permissions = permissionsFromMembership(membership);

  return {
    membershipId: membership.id,
    organizationId,
    userId,
    roles,
    permissions,
  };
}

export function assertAnyOrganizationPermission(
  context: Awaited<ReturnType<typeof getOrganizationAccessContext>>,
  keys: string[],
) {
  if (keys.some((key) => context.permissions.has(key))) return;
  if (keys.some((key) => key.startsWith("members.")) && context.permissions.has("members.manage")) return;
  throw new Error("You do not have permission to perform this organization action.");
}

function roleSlug(row: MemberListRow) {
  for (const membershipRole of row.membership_roles || []) {
    const role = normalizeOne(membershipRole.roles);
    if (role?.slug) return role.slug;
  }
  return "team-member";
}

export async function listOrganizationMembers(organizationId: string, userId: string) {
  const access = await getOrganizationAccessContext(organizationId, userId);
  assertAnyOrganizationPermission(access, ["members.view", "members.manage"]);

  const rows = await supabaseServerRequest<MemberListRow[]>(
    `organization_memberships?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,user_id,status,created_at,membership_roles(roles(slug,name))&order=created_at.asc`,
  );

  const admin = createAdminClient();
  const members = await Promise.all(rows.map(async (row) => {
    const user = await admin.auth.admin.getUserById(row.user_id);
    return {
      id: row.id,
      user_id: row.user_id,
      email: user.data.user?.email || null,
      status: row.status,
      role: roleSlug(row),
      created_at: row.created_at,
    };
  }));

  return members;
}

export async function listOrganizationInvitations(organizationId: string, userId: string) {
  const access = await getOrganizationAccessContext(organizationId, userId);
  assertAnyOrganizationPermission(access, ["members.view", "members.invite", "members.manage"]);

  return supabaseServerRequest<InvitationRow[]>(
    `organization_invitations?organization_id=eq.${encodeURIComponent(organizationId)}&status=eq.pending&select=id,email,status,expires_at,created_at,invited_by,roles(slug,name)&order=created_at.desc`,
  );
}

function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createOrganizationInvitation(input: {
  organizationId: string;
  actorUserId: string;
  email: string;
  role: "manager" | "supervisor" | "team-member";
  expiresInHours?: number;
}) {
  const access = await getOrganizationAccessContext(input.organizationId, input.actorUserId);
  assertAnyOrganizationPermission(access, ["members.invite", "members.manage"]);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(input.expiresInHours || 72, 168)) * 60 * 60 * 1000);

  const result = await supabaseServerRequest<Record<string, unknown>>(
    "rpc/create_organization_invitation",
    {
      method: "POST",
      body: JSON.stringify({
        p_organization_id: input.organizationId,
        p_actor_user_id: input.actorUserId,
        p_email: input.email.trim().toLowerCase(),
        p_role_slug: input.role,
        p_token_hash: invitationHash(token),
        p_expires_at: expiresAt.toISOString(),
      }),
    },
  );

  return {
    ...result,
    invitation_token: token,
    invitation_path: `/join?invitation=${encodeURIComponent(token)}`,
  };
}

export async function acceptOrganizationInvitation(input: {
  userId: string;
  email: string;
  token: string;
}) {
  if (!input.token || input.token.length < 20) throw new Error("Invitation token is invalid.");
  return supabaseServerRequest<{ organization_id: string; membership_id: string; role: string }>(
    "rpc/accept_organization_invitation",
    {
      method: "POST",
      body: JSON.stringify({
        p_user_id: input.userId,
        p_user_email: input.email.trim().toLowerCase(),
        p_token_hash: invitationHash(input.token),
      }),
    },
  );
}

export async function updateOrganizationMemberAccess(input: {
  organizationId: string;
  actorUserId: string;
  membershipId: string;
  role?: "manager" | "supervisor" | "team-member";
  status?: "active" | "suspended" | "removed";
}) {
  const access = await getOrganizationAccessContext(input.organizationId, input.actorUserId);
  const required = input.role ? ["members.roles.manage", "members.manage"] : ["members.suspend", "members.manage"];
  assertAnyOrganizationPermission(access, required);

  return supabaseServerRequest<Record<string, unknown>>(
    "rpc/update_organization_member_access",
    {
      method: "POST",
      body: JSON.stringify({
        p_organization_id: input.organizationId,
        p_actor_user_id: input.actorUserId,
        p_membership_id: input.membershipId,
        p_role_slug: input.role || null,
        p_status: input.status || null,
      }),
    },
  );
}

export async function revokeOrganizationInvitation(input: {
  organizationId: string;
  actorUserId: string;
  invitationId: string;
}) {
  const access = await getOrganizationAccessContext(input.organizationId, input.actorUserId);
  assertAnyOrganizationPermission(access, ["members.invite", "members.manage"]);

  return supabaseServerRequest<boolean>("rpc/revoke_organization_invitation", {
    method: "POST",
    body: JSON.stringify({
      p_organization_id: input.organizationId,
      p_actor_user_id: input.actorUserId,
      p_invitation_id: input.invitationId,
    }),
  });
}

export async function listOrganizationRolePresets(organizationId: string, userId: string) {
  const access = await getOrganizationAccessContext(organizationId, userId);
  assertAnyOrganizationPermission(access, ["members.view", "members.manage"]);

  return supabaseServerRequest<Array<Record<string, unknown>>>(
    `roles?organization_id=eq.${encodeURIComponent(organizationId)}&slug=in.(owner,manager,supervisor,team-member)&select=id,name,slug,description,role_permissions(permissions(key,description))&order=name.asc`,
  );
}

export async function setOrganizationRolePermissions(input: {
  organizationId: string;
  actorUserId: string;
  role: "manager" | "supervisor" | "team-member";
  permissions: string[];
}) {
  const access = await getOrganizationAccessContext(input.organizationId, input.actorUserId);
  assertAnyOrganizationPermission(access, ["members.roles.manage", "members.manage"]);

  const permissions = [...new Set(input.permissions.map((value) => value.trim()).filter(Boolean))];
  return supabaseServerRequest<Record<string, unknown>>(
    "rpc/set_organization_role_permissions",
    {
      method: "POST",
      body: JSON.stringify({
        p_organization_id: input.organizationId,
        p_actor_user_id: input.actorUserId,
        p_role_slug: input.role,
        p_permission_keys: permissions,
      }),
    },
  );
}
