begin;

-- The legacy permission helper does not bind a tenant-scoped role to the
-- membership's organization. Keep this guard scoped to the new real-estate
-- content tables; do not change shared policies used by other tenants.
create or replace function public.has_real_estate_permission(
  target_organization_id uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select exists (
    select 1
    from public.organizations o
    where o.id = target_organization_id
      and o.status = 'active'
      and (
        o.slug = 'limitless-realty'
        or regexp_replace(lower(coalesce(o.metadata->>'industry_slug', o.metadata->>'industry', '')), '[^a-z]', '', 'g') = 'realestate'
      )
  )
  and (
    public.is_platform_super_admin()
    or exists (
      select 1
      from public.organization_memberships om
      join public.membership_roles mr on mr.membership_id = om.id
      join public.roles r
        on r.id = mr.role_id
       and (r.organization_id is null or r.organization_id = target_organization_id)
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where om.organization_id = target_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and (
          p.key = permission_key
          or p.key = split_part(permission_key, '.', 1) || '.*'
        )
    )
  );
$function$;

alter function public.has_real_estate_permission(uuid, text) owner to postgres;
revoke all on function public.has_real_estate_permission(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.has_real_estate_permission(uuid, text) to authenticated;

-- Replace only the three newly introduced write policies. Read policies and
-- all pre-existing tenant policies remain untouched.
drop policy if exists real_estate_estates_authorized_write on public.real_estate_estates;
create policy real_estate_estates_authorized_write on public.real_estate_estates
for all to authenticated
using (
  public.has_real_estate_permission(organization_id, 'customers.manage')
  and public.has_real_estate_permission(organization_id, 'knowledge.manage')
)
with check (
  public.has_real_estate_permission(organization_id, 'customers.manage')
  and public.has_real_estate_permission(organization_id, 'knowledge.manage')
);

drop policy if exists real_estate_estate_faqs_authorized_write on public.real_estate_estate_faqs;
create policy real_estate_estate_faqs_authorized_write on public.real_estate_estate_faqs
for all to authenticated
using (public.has_real_estate_permission(organization_id, 'knowledge.manage'))
with check (public.has_real_estate_permission(organization_id, 'knowledge.manage'));

drop policy if exists real_estate_estate_knowledge_write on public.real_estate_estate_knowledge_links;
create policy real_estate_estate_knowledge_write on public.real_estate_estate_knowledge_links
for all to authenticated
using (public.has_real_estate_permission(organization_id, 'knowledge.manage'))
with check (public.has_real_estate_permission(organization_id, 'knowledge.manage'));

commit;
