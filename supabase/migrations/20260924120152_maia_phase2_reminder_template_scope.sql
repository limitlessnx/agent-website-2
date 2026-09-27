update public.reminder_templates
set organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
where organization_id is null;

alter table public.reminder_templates
  alter column organization_id set not null;

drop policy if exists organization_follow_up_policies_tenant_member_access
on public.organization_follow_up_policies;

create policy organization_follow_up_policies_tenant_member_access
on public.organization_follow_up_policies
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
