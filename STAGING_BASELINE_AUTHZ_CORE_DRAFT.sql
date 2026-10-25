-- CANDIDATE ONLY — NOT A SUPABASE MIGRATION. DO NOT APPLY.
-- Execute only in an isolated test fixture until a complete dependency-reviewed baseline
-- and explicit staging DDL authorization exist. The eventual migration role must be the
-- trusted postgres owner; browser roles must not own any referenced table or function.
-- Post-core-schema prerequisite: organizations, organization_memberships, membership_roles,
-- roles, permissions, role_permissions, platform_super_admins, plus auth.uid().
-- This is a replacement policy set for an empty/rebuilt staging baseline. Do not layer it
-- alongside the original permissive policies in STAGING_BASELINE_DDL_PREVIEW.sql.
-- It preserves the platform-admin boolean bypass, removes browser table access to the
-- platform-admin registry, and enforces same-organization roles at both assignment and
-- permission-check time. Membership and role organization IDs are immutable in this draft,
-- preventing a later parent update from changing an existing tenant-role relationship.
-- Service-role table grants are not changed by this draft.
-- Optional billing, payment, submission-claim, and system-routing modules are excluded.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_super_admins AS psa
    WHERE psa.user_id = auth.uid()
      AND psa.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.is_platform_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.organization_memberships AS om
        WHERE om.organization_id = target_organization_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
      );
$function$;

CREATE OR REPLACE FUNCTION public.has_organization_permission(
  target_organization_id uuid,
  permission_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT public.is_platform_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.organization_memberships AS om
        JOIN public.membership_roles AS mr
          ON mr.membership_id = om.id
        JOIN public.roles AS r
          ON r.id = mr.role_id
         AND (r.organization_id IS NULL OR r.organization_id = target_organization_id)
        JOIN public.role_permissions AS rp
          ON rp.role_id = r.id
        JOIN public.permissions AS p
          ON p.id = rp.permission_id
        WHERE om.organization_id = target_organization_id
          AND om.user_id = auth.uid()
          AND om.status = 'active'
          AND (
            p.key = permission_key
            OR p.key = split_part(permission_key, '.', 1) || '.*'
          )
      );
$function$;

CREATE OR REPLACE FUNCTION public.enforce_membership_role_tenant_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_membership_organization_id uuid;
  v_role_organization_id uuid;
BEGIN
  IF NEW.membership_id IS NULL OR NEW.role_id IS NULL THEN
    RAISE EXCEPTION 'Membership and role are required';
  END IF;

  SELECT om.organization_id
    INTO v_membership_organization_id
    FROM public.organization_memberships AS om
   WHERE om.id = NEW.membership_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membership does not exist';
  END IF;

  SELECT r.organization_id
    INTO v_role_organization_id
    FROM public.roles AS r
   WHERE r.id = NEW.role_id
   FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role does not exist';
  END IF;

  IF v_role_organization_id IS NOT NULL
     AND v_role_organization_id <> v_membership_organization_id THEN
    RAISE EXCEPTION 'A membership cannot receive a role from another organization';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_membership_organization_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Membership organization_id is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_role_organization_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'Role organization_id is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER FUNCTION public.is_platform_super_admin() OWNER TO postgres;
ALTER FUNCTION public.is_organization_member(uuid) OWNER TO postgres;
ALTER FUNCTION public.has_organization_permission(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.enforce_membership_role_tenant_scope() OWNER TO postgres;
ALTER FUNCTION public.prevent_membership_organization_change() OWNER TO postgres;
ALTER FUNCTION public.prevent_role_organization_change() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_platform_super_admin() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_organization_permission(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.enforce_membership_role_tenant_scope() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_membership_organization_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.prevent_role_organization_change() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_organization_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_membership_role_tenant_scope() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_membership_organization_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.prevent_role_organization_change() TO service_role;

ALTER TABLE public.organizations OWNER TO postgres;
ALTER TABLE public.organization_memberships OWNER TO postgres;
ALTER TABLE public.membership_roles OWNER TO postgres;
ALTER TABLE public.roles OWNER TO postgres;
ALTER TABLE public.permissions OWNER TO postgres;
ALTER TABLE public.role_permissions OWNER TO postgres;
ALTER TABLE public.platform_super_admins OWNER TO postgres;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_super_admins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organizations,
  public.organization_memberships,
  public.membership_roles,
  public.roles,
  public.permissions,
  public.role_permissions
FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organizations,
  public.organization_memberships,
  public.membership_roles,
  public.roles,
  public.permissions,
  public.role_permissions
TO authenticated;

-- Platform-admin identities are visible only through the protected boolean helper.
REVOKE ALL ON TABLE public.platform_super_admins FROM PUBLIC, anon, authenticated;

-- Replace only the observed permissive policies; this draft intentionally grants no
-- direct browser-role INSERT, UPDATE, or DELETE policy on the authorization tables.
DROP POLICY IF EXISTS organizations_member_select ON public.organizations;
DROP POLICY IF EXISTS memberships_admin_manage ON public.organization_memberships;
DROP POLICY IF EXISTS memberships_member_select ON public.organization_memberships;
DROP POLICY IF EXISTS memberships_self_select ON public.organization_memberships;
DROP POLICY IF EXISTS memberships_team_view ON public.organization_memberships;
DROP POLICY IF EXISTS membership_roles_team_view ON public.membership_roles;
DROP POLICY IF EXISTS roles_member_select ON public.roles;
DROP POLICY IF EXISTS permissions_authenticated_select ON public.permissions;
DROP POLICY IF EXISTS role_permissions_team_view ON public.role_permissions;

CREATE POLICY organizations_member_select
  ON public.organizations AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_organization_member(id));

-- Self-read is limited to active memberships; management/view permissions may inspect
-- inactive rows in the same organization, and the platform-admin bypass remains explicit.
CREATE POLICY memberships_self_or_authorized_select
  ON public.organization_memberships AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'active')
    OR public.has_organization_permission(organization_id, 'members.view')
    OR public.has_organization_permission(organization_id, 'members.manage')
  );

CREATE POLICY membership_roles_self_or_authorized_select
  ON public.membership_roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_memberships AS om
      WHERE om.id = membership_roles.membership_id
        AND (
          (om.user_id = auth.uid() AND om.status = 'active')
          OR public.has_organization_permission(om.organization_id, 'members.view')
          OR public.has_organization_permission(om.organization_id, 'members.manage')
        )
        AND EXISTS (
          SELECT 1
          FROM public.roles AS r
          WHERE r.id = membership_roles.role_id
            AND (r.organization_id IS NULL OR r.organization_id = om.organization_id)
        )
    )
  );

CREATE POLICY roles_member_select
  ON public.roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_organization_member(organization_id));

CREATE POLICY permissions_authenticated_select
  ON public.permissions AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

CREATE POLICY role_permissions_member_select
  ON public.role_permissions AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles AS r
      WHERE r.id = role_permissions.role_id
        AND (r.organization_id IS NULL OR public.is_organization_member(r.organization_id))
    )
  );

CREATE TRIGGER membership_roles_enforce_tenant_scope
  BEFORE INSERT OR UPDATE OF membership_id, role_id
  ON public.membership_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_membership_role_tenant_scope();

CREATE TRIGGER memberships_organization_immutable
  BEFORE UPDATE OF organization_id
  ON public.organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_membership_organization_change();

CREATE TRIGGER roles_organization_immutable
  BEFORE UPDATE OF organization_id
  ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_organization_change();

-- A membership moving to another organization must be deactivated and recreated with a
-- fresh membership ID; create a new tenant-scoped role rather than repurposing an existing one.
COMMIT;
