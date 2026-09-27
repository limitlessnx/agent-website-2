drop index if exists public.gencouv_raw_leads_org_source_unique;

create unique index if not exists gencouv_raw_leads_org_normalized_email_unique
  on public.gencouv_raw_leads (organization_id, normalized_email)
  where normalized_email is not null and btrim(normalized_email) <> '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gencouv_campaign_settings_daily_new_lead_limit_range'
      and conrelid = 'public.gencouv_campaign_settings'::regclass
  ) then
    alter table public.gencouv_campaign_settings
      add constraint gencouv_campaign_settings_daily_new_lead_limit_range
      check (daily_new_lead_limit between 30 and 200);
  end if;
end $$;
