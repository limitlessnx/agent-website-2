-- Prevent a child row from pointing at a parent belonging to another tenant.
create unique index if not exists leads_org_id_unique
  on public.leads (organization_id, id);

create unique index if not exists properties_org_id_unique
  on public.properties (organization_id, id);

create unique index if not exists viewings_org_id_unique
  on public.viewings (organization_id, id);

alter table public.follow_ups
  add constraint follow_ups_tenant_lead_fkey
  foreign key (organization_id, lead_id)
  references public.leads (organization_id, id)
  on delete cascade;

alter table public.property_matches
  add constraint property_matches_tenant_lead_fkey
  foreign key (organization_id, lead_id)
  references public.leads (organization_id, id)
  on delete cascade;

alter table public.property_matches
  add constraint property_matches_tenant_property_fkey
  foreign key (organization_id, property_id)
  references public.properties (organization_id, id)
  on delete cascade;

alter table public.viewings
  add constraint viewings_tenant_lead_fkey
  foreign key (organization_id, lead_id)
  references public.leads (organization_id, id)
  on delete cascade;

alter table public.viewings
  add constraint viewings_tenant_property_fkey
  foreign key (organization_id, property_id)
  references public.properties (organization_id, id)
  on delete cascade;

alter table public.viewing_reminders
  add constraint viewing_reminders_tenant_lead_fkey
  foreign key (organization_id, lead_id)
  references public.leads (organization_id, id)
  on delete cascade;

alter table public.viewing_reminders
  add constraint viewing_reminders_tenant_viewing_fkey
  foreign key (organization_id, viewing_id)
  references public.viewings (organization_id, id)
  on delete cascade;

alter table public.closed_deals
  add constraint closed_deals_tenant_lead_fkey
  foreign key (organization_id, lead_id)
  references public.leads (organization_id, id)
  on delete cascade;

alter table public.closed_deals
  add constraint closed_deals_tenant_property_fkey
  foreign key (organization_id, property_id)
  references public.properties (organization_id, id)
  on delete cascade;
