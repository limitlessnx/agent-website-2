alter table if exists public.leads
  add column if not exists profile_status text not null default 'undocumented',
  add column if not exists campaign_eligible boolean not null default true,
  add column if not exists property_interest text,
  add column if not exists email text,
  add column if not exists notes text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'budget'
  ) then
    alter table public.leads alter column budget drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'location_preference'
  ) then
    alter table public.leads alter column location_preference drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'property_type'
  ) then
    alter table public.leads alter column property_type drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'purpose'
  ) then
    alter table public.leads alter column purpose drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'leads' and column_name = 'score'
  ) then
    alter table public.leads alter column score drop not null;
  end if;
end $$;

update public.leads
set profile_status = case
  when nullif(trim(coalesce(budget, '')), '') is null
   and nullif(trim(coalesce(location_preference, '')), '') is null
   and nullif(trim(coalesce(property_type, '')), '') is null
   and nullif(trim(coalesce(purpose, '')), '') is null
   and nullif(trim(coalesce(property_interest, '')), '') is null
    then 'undocumented'
  when (
    (case when nullif(trim(coalesce(budget, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(location_preference, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(property_type, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(purpose, '')), '') is not null then 1 else 0 end) +
    (case when nullif(trim(coalesce(property_interest, '')), '') is not null then 1 else 0 end)
  ) >= 4 then 'documented'
  else 'partial'
end
where profile_status is null or profile_status not in ('undocumented', 'partial', 'documented');

alter table public.leads
  drop constraint if exists leads_profile_status_check;

alter table public.leads
  add constraint leads_profile_status_check
  check (profile_status in ('undocumented', 'partial', 'documented'));

create index if not exists leads_campaign_eligible_idx
  on public.leads (campaign_eligible, status);

create index if not exists leads_profile_status_idx
  on public.leads (profile_status);

create index if not exists leads_location_preference_idx
  on public.leads (location_preference);

create index if not exists leads_property_interest_idx
  on public.leads (property_interest);
