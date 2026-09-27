-- Phase 2: make Maia's legacy operational tables explicitly tenant-scoped.
-- Existing legacy lead rows belong to the canonical Limitless Realty Maia tenant.
do $$
declare
  limitless_org uuid := 'b15f21b4-5697-4d21-9421-8a34eae3476d';
begin
  if not exists (select 1 from public.organizations where id = limitless_org) then
    raise exception 'Limitless Realty organization not found';
  end if;
end $$;

alter table public.leads
  add column if not exists organization_id uuid;

update public.leads
set organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
where organization_id is null;

alter table public.leads
  alter column organization_id set not null;

alter table public.leads
  drop constraint if exists leads_phone_key;

alter table public.leads
  drop constraint if exists leads_organization_id_fkey;

alter table public.leads
  add constraint leads_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

create unique index if not exists leads_org_phone_unique
  on public.leads (organization_id, phone)
  where phone is not null;

create index if not exists leads_org_status_idx
  on public.leads (organization_id, status, updated_at desc);

create index if not exists leads_org_last_contacted_idx
  on public.leads (organization_id, last_contacted_at desc);

alter table public.property_matches
  add column if not exists organization_id uuid;

alter table public.viewings
  add column if not exists organization_id uuid;

alter table public.viewing_reminders
  add column if not exists organization_id uuid;

alter table public.closed_deals
  add column if not exists organization_id uuid;

alter table public.daily_reports
  add column if not exists organization_id uuid;

-- Backfill any legacy child rows by their parent relationship where possible.
update public.property_matches pm
set organization_id = l.organization_id
from public.leads l
where pm.organization_id is null and pm.lead_id = l.id;

update public.viewings v
set organization_id = l.organization_id
from public.leads l
where v.organization_id is null and v.lead_id = l.id;

update public.viewing_reminders vr
set organization_id = l.organization_id
from public.leads l
where vr.organization_id is null and vr.lead_id = l.id;

update public.closed_deals cd
set organization_id = l.organization_id
from public.leads l
where cd.organization_id is null and cd.lead_id = l.id;

-- The legacy report table is Maia-specific; preserve any historical rows under Limitless Realty.
update public.daily_reports
set organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
where organization_id is null;

-- Existing follow-ups already have organization_id but must become tenant-mandatory.
update public.follow_ups f
set organization_id = l.organization_id
from public.leads l
where f.organization_id is null and f.lead_id = l.id;

alter table public.property_matches alter column organization_id set not null;
alter table public.viewings alter column organization_id set not null;
alter table public.viewing_reminders alter column organization_id set not null;
alter table public.closed_deals alter column organization_id set not null;
alter table public.daily_reports alter column organization_id set not null;
alter table public.follow_ups alter column organization_id set not null;

alter table public.property_matches
  add constraint property_matches_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.viewings
  add constraint viewings_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.viewing_reminders
  add constraint viewing_reminders_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.closed_deals
  add constraint closed_deals_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.daily_reports
  add constraint daily_reports_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

create index if not exists property_matches_org_lead_idx
  on public.property_matches (organization_id, lead_id, created_at desc);

create index if not exists viewings_org_datetime_idx
  on public.viewings (organization_id, viewing_datetime, status);

create index if not exists viewing_reminders_org_status_idx
  on public.viewing_reminders (organization_id, status, viewing_datetime);

create index if not exists follow_ups_org_schedule_idx
  on public.follow_ups (organization_id, status, scheduled_at);

create index if not exists closed_deals_org_closed_idx
  on public.closed_deals (organization_id, closed_at desc);

create index if not exists daily_reports_org_date_idx
  on public.daily_reports (organization_id, report_date desc);

-- Tenant access policies for operational data.
drop policy if exists leads_tenant_member_access on public.leads;
create policy leads_tenant_member_access
on public.leads
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists properties_tenant_member_access on public.properties;
create policy properties_tenant_member_access
on public.properties
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists property_matches_tenant_member_access on public.property_matches;
create policy property_matches_tenant_member_access
on public.property_matches
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists follow_ups_tenant_member_access on public.follow_ups;
create policy follow_ups_tenant_member_access
on public.follow_ups
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists viewings_tenant_member_access on public.viewings;
create policy viewings_tenant_member_access
on public.viewings
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists viewing_reminders_tenant_member_access on public.viewing_reminders;
create policy viewing_reminders_tenant_member_access
on public.viewing_reminders
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists closed_deals_tenant_member_access on public.closed_deals;
create policy closed_deals_tenant_member_access
on public.closed_deals
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists daily_reports_tenant_member_access on public.daily_reports;
create policy daily_reports_tenant_member_access
on public.daily_reports
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
