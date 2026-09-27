create table if not exists public.whatsapp_twilio_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  integration_id uuid references public.organization_integrations(id) on delete cascade,
  status text not null default 'not_started'
    check(status in ('not_started','embedded_signup','provisioning_subaccount','registering_sender','awaiting_sender_online','connected','degraded','failed','disconnected')),
  meta_waba_id text,
  meta_phone_number_id text,
  sender_phone_e164 text,
  sender_profile_name text,
  number_source text not null default 'customer'
    check(number_source in ('customer','twilio_sms','twilio_voice')),
  twilio_subaccount_sid text unique,
  twilio_sender_sid text unique,
  twilio_sender_status text,
  last_error_code text,
  last_error_message text,
  provider_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  embedded_signup_completed_at timestamptz,
  sender_registered_at timestamptz,
  connected_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,meta_waba_id)
);

create table if not exists public.whatsapp_twilio_onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid not null,
  status text not null default 'started'
    check(status in ('started','embedded_signup_complete','provisioning','complete','failed','cancelled','expired')),
  number_source text not null default 'customer'
    check(number_source in ('customer','twilio_sms','twilio_voice')),
  sender_phone_e164 text,
  sender_profile_name text,
  meta_waba_id text,
  meta_phone_number_id text,
  last_error text,
  expires_at timestamptz not null default (now()+interval '30 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,membership_id)
    references public.organization_memberships(organization_id,id)
    on delete cascade
);

create index if not exists whatsapp_twilio_bindings_status_idx
  on public.whatsapp_twilio_bindings(status,last_checked_at);
create index if not exists whatsapp_twilio_sessions_org_idx
  on public.whatsapp_twilio_onboarding_sessions(organization_id,created_at desc);

alter table public.whatsapp_twilio_bindings enable row level security;
alter table public.whatsapp_twilio_onboarding_sessions enable row level security;

revoke all on public.whatsapp_twilio_bindings,public.whatsapp_twilio_onboarding_sessions
from anon,authenticated;
grant select on public.whatsapp_twilio_bindings,public.whatsapp_twilio_onboarding_sessions
to authenticated;
grant all on public.whatsapp_twilio_bindings,public.whatsapp_twilio_onboarding_sessions
to service_role;

create policy whatsapp_twilio_bindings_select
on public.whatsapp_twilio_bindings
for select to authenticated
using(
  public.has_organization_permission(organization_id,'integrations.view')
  or public.has_organization_permission(organization_id,'integrations.manage')
);

create policy whatsapp_twilio_sessions_select
on public.whatsapp_twilio_onboarding_sessions
for select to authenticated
using(
  public.has_organization_permission(organization_id,'integrations.manage')
);

create or replace function public.upsert_whatsapp_twilio_binding(
  p_organization_id uuid,
  p_integration_id uuid,
  p_status text,
  p_meta_waba_id text default null,
  p_meta_phone_number_id text default null,
  p_sender_phone_e164 text default null,
  p_sender_profile_name text default null,
  p_number_source text default 'customer',
  p_twilio_subaccount_sid text default null,
  p_twilio_sender_sid text default null,
  p_twilio_sender_status text default null,
  p_last_error_code text default null,
  p_last_error_message text default null,
  p_provider_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v public.whatsapp_twilio_bindings%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role required'; end if;
  if p_status not in ('not_started','embedded_signup','provisioning_subaccount','registering_sender','awaiting_sender_online','connected','degraded','failed','disconnected') then
    raise exception 'Invalid WhatsApp Twilio binding status';
  end if;
  if p_number_source not in ('customer','twilio_sms','twilio_voice') then
    raise exception 'Invalid WhatsApp number source';
  end if;

  insert into public.whatsapp_twilio_bindings(
    organization_id,integration_id,status,meta_waba_id,meta_phone_number_id,
    sender_phone_e164,sender_profile_name,number_source,twilio_subaccount_sid,
    twilio_sender_sid,twilio_sender_status,last_error_code,last_error_message,
    provider_metadata,started_at,embedded_signup_completed_at,sender_registered_at,
    connected_at,last_checked_at
  ) values(
    p_organization_id,p_integration_id,p_status,nullif(trim(p_meta_waba_id),''),
    nullif(trim(p_meta_phone_number_id),''),nullif(trim(p_sender_phone_e164),''),
    nullif(trim(p_sender_profile_name),''),p_number_source,
    nullif(trim(p_twilio_subaccount_sid),''),nullif(trim(p_twilio_sender_sid),''),
    nullif(trim(p_twilio_sender_status),''),nullif(trim(p_last_error_code),''),
    nullif(trim(p_last_error_message),''),coalesce(p_provider_metadata,'{}'::jsonb),
    now(),
    case when p_meta_waba_id is not null then now() else null end,
    case when p_twilio_sender_sid is not null then now() else null end,
    case when p_status='connected' then now() else null end,
    now()
  )
  on conflict(organization_id) do update set
    integration_id=coalesce(excluded.integration_id,public.whatsapp_twilio_bindings.integration_id),
    status=excluded.status,
    meta_waba_id=coalesce(excluded.meta_waba_id,public.whatsapp_twilio_bindings.meta_waba_id),
    meta_phone_number_id=coalesce(excluded.meta_phone_number_id,public.whatsapp_twilio_bindings.meta_phone_number_id),
    sender_phone_e164=coalesce(excluded.sender_phone_e164,public.whatsapp_twilio_bindings.sender_phone_e164),
    sender_profile_name=coalesce(excluded.sender_profile_name,public.whatsapp_twilio_bindings.sender_profile_name),
    number_source=excluded.number_source,
    twilio_subaccount_sid=coalesce(excluded.twilio_subaccount_sid,public.whatsapp_twilio_bindings.twilio_subaccount_sid),
    twilio_sender_sid=coalesce(excluded.twilio_sender_sid,public.whatsapp_twilio_bindings.twilio_sender_sid),
    twilio_sender_status=coalesce(excluded.twilio_sender_status,public.whatsapp_twilio_bindings.twilio_sender_status),
    last_error_code=excluded.last_error_code,
    last_error_message=excluded.last_error_message,
    provider_metadata=public.whatsapp_twilio_bindings.provider_metadata||excluded.provider_metadata,
    embedded_signup_completed_at=case when excluded.meta_waba_id is not null then coalesce(public.whatsapp_twilio_bindings.embedded_signup_completed_at,now()) else public.whatsapp_twilio_bindings.embedded_signup_completed_at end,
    sender_registered_at=case when excluded.twilio_sender_sid is not null then coalesce(public.whatsapp_twilio_bindings.sender_registered_at,now()) else public.whatsapp_twilio_bindings.sender_registered_at end,
    connected_at=case when excluded.status='connected' then coalesce(public.whatsapp_twilio_bindings.connected_at,now()) else public.whatsapp_twilio_bindings.connected_at end,
    last_checked_at=now(),
    updated_at=now()
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.upsert_whatsapp_twilio_binding(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb
) from public,anon,authenticated;
grant execute on function public.upsert_whatsapp_twilio_binding(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,jsonb
) to service_role;
