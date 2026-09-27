alter table public.appointments
  add column if not exists assigned_membership_id uuid;

do $$
begin
  alter table public.appointments
    add constraint appointments_assigned_membership_org_fkey
    foreign key (organization_id,assigned_membership_id)
    references public.organization_memberships(organization_id,id)
    on delete set null (assigned_membership_id);
exception when duplicate_object then null;
end $$;

create index if not exists appointments_org_assigned_staff_idx
  on public.appointments(organization_id,assigned_membership_id,start_at)
  where assigned_membership_id is not null;
