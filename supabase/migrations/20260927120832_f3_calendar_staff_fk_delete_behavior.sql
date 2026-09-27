alter table public.appointment_calendar_resources
  drop constraint if exists appointment_calendar_resources_assigned_membership_org_fkey;

alter table public.appointment_calendar_resources
  add constraint appointment_calendar_resources_assigned_membership_org_fkey
  foreign key (organization_id,assigned_membership_id)
  references public.organization_memberships(organization_id,id)
  on delete set null (assigned_membership_id);
