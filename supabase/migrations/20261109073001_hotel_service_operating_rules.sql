-- Additive service guidance. Existing catalog RLS, revisions and publication guard apply.
create function public.hotel_service_rules_valid(value jsonb)
returns boolean language sql immutable parallel safe set search_path = '' as $$
  select case when jsonb_typeof(value) <> 'object' then false else
    not exists (
      select 1 from jsonb_each(value) as field(key, content)
      where key not in ('questions_to_ask','booking_requirements','restrictions','escalation_rules','concierge_guidance')
         or jsonb_typeof(content) <> 'string'
         or length(content #>> '{}') > 2000
    )
  end;
$$;
revoke all on function public.hotel_service_rules_valid(jsonb) from public, anon, authenticated;
grant execute on function public.hotel_service_rules_valid(jsonb) to service_role;
alter table public.hotel_catalog_items
  add column service_rules jsonb not null default '{}'::jsonb,
  add constraint hotel_catalog_service_rules_valid check (public.hotel_service_rules_valid(service_rules)),
  add constraint hotel_catalog_room_has_no_service_rules check (kind = 'service' or service_rules = '{}'::jsonb);
comment on column public.hotel_catalog_items.service_rules is
  'Service business guidance, subordinate to hotel and platform rules. Published-only concierge retrieval. Not a system prompt or permission grant.';
