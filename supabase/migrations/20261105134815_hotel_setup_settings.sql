-- Pending hotel-only setup. No production application in this phase.
create table public.hotel_settings(
 organization_id uuid primary key references public.organizations(id),"values" jsonb not null check(jsonb_typeof("values")='object'),
 revision integer not null default 1 check(revision>0),updated_by uuid not null,updated_at timestamptz not null default now()
);
create table public.hotel_settings_history(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 revision integer not null,"values" jsonb not null,actor_id uuid not null,created_at timestamptz not null default now(),unique(organization_id,revision)
);
alter table public.hotel_settings enable row level security;
alter table public.hotel_settings_history enable row level security;
revoke all on public.hotel_settings,public.hotel_settings_history from anon,authenticated;
grant all on public.hotel_settings,public.hotel_settings_history to service_role;
grant select on public.hotel_settings,public.hotel_settings_history to authenticated;
create policy hotel_settings_read on public.hotel_settings for select to authenticated using(public.has_organization_permission(organization_id,'organization.manage'));
create policy hotel_settings_history_read on public.hotel_settings_history for select to authenticated using(public.has_organization_permission(organization_id,'organization.manage'));
create function public.hotel_save_settings(p_organization_id uuid,p_actor uuid,p_revision integer,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare current_revision integer;entry record;
begin
 if p_organization_id is null or p_actor is null or p_revision is null or p_revision<0 or p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Invalid hotel settings';end if;
 if (select count(*) from jsonb_object_keys(p_values))<>15 or not(p_values ?& array['business_name','address','country','business_email','phone','timezone','currency','check_in','check_out','cancellation_policy','inclusions','guest_rules','escalation_name','escalation_email','escalation_phone']) then raise exception 'Invalid settings fields';end if;
 for entry in select * from jsonb_each(p_values) loop
  if jsonb_typeof(entry.value)<>'string' or length(entry.value#>>'{}')>(case when entry.key in ('cancellation_policy','inclusions','guest_rules') then 4000 when entry.key='address' then 500 when entry.key in ('business_email','escalation_email') then 240 when entry.key in ('business_name','escalation_name') then 180 when entry.key in ('check_in','check_out') then 5 when entry.key='currency' then 3 else 80 end) then raise exception 'Invalid settings value';end if;
 end loop;
 if btrim(p_values->>'business_name')='' or not exists(select 1 from pg_timezone_names where name=p_values->>'timezone') or (p_values->>'currency')!~'^[A-Z]{3}$' then raise exception 'Invalid business name, time zone or currency';end if;
 if exists(select 1 from jsonb_each_text(p_values) where key in ('check_in','check_out') and value<>'' and value!~'^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'Invalid local hotel time';end if;
 perform pg_advisory_xact_lock(hashtextextended('hotel-settings:'||p_organization_id::text,0));
 select revision into current_revision from hotel_settings where organization_id=p_organization_id for update;
 if coalesce(current_revision,0)<>p_revision then raise exception 'Hotel settings changed';end if;
 insert into hotel_settings(organization_id,"values",revision,updated_by) values(p_organization_id,p_values,p_revision+1,p_actor)
 on conflict(organization_id) do update set "values"=excluded."values",revision=excluded.revision,updated_by=p_actor,updated_at=now();
 insert into hotel_settings_history(organization_id,revision,"values",actor_id) values(p_organization_id,p_revision+1,p_values,p_actor);
 -- Keep existing portal identity and hotel-local dashboard dates consistent atomically.
 update client_onboarding_profiles set business_name=p_values->>'business_name',business_email=p_values->>'business_email',phone=p_values->>'phone',country=p_values->>'country',timezone=p_values->>'timezone',human_contact_name=p_values->>'escalation_name',human_contact_email=p_values->>'escalation_email' where organization_id=p_organization_id;
 return jsonb_build_object('revision',p_revision+1);
end $$;
revoke all on function public.hotel_save_settings(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.hotel_save_settings(uuid,uuid,integer,jsonb) to service_role;
