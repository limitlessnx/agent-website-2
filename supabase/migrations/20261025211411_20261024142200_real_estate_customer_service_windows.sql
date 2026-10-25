create table if not exists public.real_estate_customer_service_windows (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_normalized text not null check (phone_normalized ~ '^[0-9]{8,15}$'),
  provider text not null check (provider = 'meta_whatsapp'),
  last_inbound_at timestamptz not null,
  last_provider_message_id text not null check (length(last_provider_message_id) between 1 and 200),
  updated_at timestamptz not null default now(),
  primary key (organization_id, phone_normalized),
  unique (organization_id, provider, last_provider_message_id)
);

alter table public.real_estate_customer_service_windows enable row level security;
revoke all on table public.real_estate_customer_service_windows from public, anon, authenticated;
grant select, insert, update, delete on table public.real_estate_customer_service_windows to service_role;

create or replace function public.record_real_estate_customer_service_window(
  p_organization_id uuid,
  p_phone_normalized text,
  p_provider text,
  p_provider_message_id text,
  p_last_inbound_at timestamptz
)
returns table(applied boolean, stored_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing timestamptz;
  v_real_estate boolean;
begin
  if p_organization_id is null
    or p_phone_normalized is null
    or p_phone_normalized !~ '^[0-9]{8,15}$'
    or p_provider is distinct from 'meta_whatsapp'
    or p_provider_message_id is null
    or length(p_provider_message_id) not between 1 and 200
    or p_last_inbound_at is null
    or p_last_inbound_at > now() + interval '5 minutes'
  then
    raise exception 'Invalid inbound service-window event.' using errcode = '22023';
  end if;

  select o.status = 'active' and (
    o.slug = 'limitless-realty'
    or lower(regexp_replace(coalesce(o.metadata->>'industry_slug', o.metadata->>'industry', ''), '[^a-z]', '', 'g')) = 'realestate'
  ) into v_real_estate
  from public.organizations o
  where o.id = p_organization_id;

  if coalesce(v_real_estate, false) is not true then
    raise exception 'Active real-estate organization is required.' using errcode = '42501';
  end if;

  insert into public.real_estate_customer_service_windows as existing (
    organization_id, phone_normalized, provider, last_inbound_at, last_provider_message_id, updated_at
  ) values (
    p_organization_id, p_phone_normalized, p_provider, p_last_inbound_at, p_provider_message_id, now()
  )
  on conflict (organization_id, phone_normalized) do update set
    provider = case when excluded.last_inbound_at >= existing.last_inbound_at then excluded.provider else existing.provider end,
    last_provider_message_id = case when excluded.last_inbound_at >= existing.last_inbound_at then excluded.last_provider_message_id else existing.last_provider_message_id end,
    last_inbound_at = greatest(existing.last_inbound_at, excluded.last_inbound_at),
    updated_at = now()
  returning true, existing.last_inbound_at into applied, stored_at;

  return next;
end;
$$;

revoke all on function public.record_real_estate_customer_service_window(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.record_real_estate_customer_service_window(uuid, text, text, text, timestamptz) to service_role;
