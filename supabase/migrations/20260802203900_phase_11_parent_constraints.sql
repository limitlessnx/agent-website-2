do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.domain_events'::regclass
      and contype = 'u'
      and conname = 'domain_events_organization_id_id_key'
  ) then
    alter table public.domain_events
      add constraint domain_events_organization_id_id_key unique (organization_id, id);
  end if;
end $$;
