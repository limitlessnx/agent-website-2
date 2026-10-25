begin;

-- Phase 2 is intentionally opt-in and limited to existing registered Leo
-- mutations that may target the verified Limitless Realty workspace.
create table public.real_estate_action_approvals (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade
,
  principal_kind text not null check (principal_kind in ('user', 'super_admin_email')),
  principal_id text not null check (length(btrim(principal_id)) between 1 and 320),
  tool_key text not null check (tool_key in (
    'leo.limitless.followup.send',
    'leo.limitless.campaign.send',
    'leo.crm.leads.update',
    'leo.crm.followup.send',
    'leo.campaign.send',
    'leo.appointment.manage',
    'leo.agent.pause',
    'leo.agent.resume'
  )),
  arguments_digest text not null check (arguments_digest ~ '^[0-9a-f]{64}$'),
  session_id text not null check (length(btrim(session_id)) between 1 and 512),
  channel text not null check (channel in ('chat', 'voice', 'api')),
  token_digest text not null check (token_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'issued' check (status in ('issued', 'consumed', 'expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index real_estate_action_approvals_org_status_idx
  on public.real_estate_action_approvals(organization_id, status, expires_at);

alter table public.real_estate_action_approvals enable row level security;
revoke all on public.real_estate_action_approvals from public, anon, authenticated;
grant all on public.real_estate_action_approvals to service_role;

create or replace function public.create_real_estate_action_approval(
  p_approval_id uuid,
  p_organization_id uuid,
  p_principal_kind text,
  p_principal_id text,
  p_tool_key text,
  p_arguments_digest text,
  p_session_id text,
  p_channel text,
  p_token_digest text,
  p_expires_at timestamptz,
  p_real_estate_opt_in boolean default false
)
returns table(approval_id uuid, status text, expires_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_real_estate_opt_in is not true then
    raise exception 'Real-estate approval opt-in is required';
  end if;
  if not exists (select 1 from public.organizations o where o.id=p_organization_id and o.status='active' and (o.slug='limitless-realty' or regexp_replace(lower(coalesce(o.metadata->>'industry_slug',o.metadata->>'industry','')), '[^a-z]', '', 'g')='realestate')) then
    raise exception 'Approval organization is not an active opted-in real-estate workspace';
  end if;
  if p_tool_key not in (
    'leo.limitless.followup.send', 'leo.limitless.campaign.send',
    'leo.crm.leads.update', 'leo.crm.followup.send', 'leo.campaign.send',
    'leo.appointment.manage', 'leo.agent.pause', 'leo.agent.resume'
  ) then
    raise exception 'Tool is outside the real-estate approval scope';
  end if;
  if p_expires_at <= clock_timestamp() then
    raise exception 'Approval expiry must be in the future';
  end if;

  insert into public.real_estate_action_approvals(
    id, organization_id, principal_kind, principal_id, tool_key,
    arguments_digest, session_id, channel, token_digest, expires_at
  ) values (
    p_approval_id, p_organization_id, p_principal_kind, btrim(p_principal_id),
    p_tool_key, p_arguments_digest, btrim(p_session_id), p_channel,
    p_token_digest, p_expires_at
  );

  return query
  select id, real_estate_action_approvals.status, real_estate_action_approvals.expires_at
  from public.real_estate_action_approvals
  where id = p_approval_id;
end;
$$;

create or replace function public.consume_real_estate_action_approval(
  p_approval_id uuid,
  p_organization_id uuid,
  p_principal_kind text,
  p_principal_id text,
  p_tool_key text,
  p_arguments_digest text,
  p_session_id text,
  p_channel text,
  p_token_digest text,
  p_real_estate_opt_in boolean default false
)
returns table(approval_id uuid, status text, consumed_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_approval public.real_estate_action_approvals%rowtype;
  v_consumed_at timestamptz;
begin
  if p_real_estate_opt_in is not true
     or p_tool_key not in (
       'leo.limitless.followup.send', 'leo.limitless.campaign.send',
       'leo.crm.leads.update', 'leo.crm.followup.send', 'leo.campaign.send',
       'leo.appointment.manage', 'leo.agent.pause', 'leo.agent.resume'
     ) then
    return query select p_approval_id, 'rejected'::text, null::timestamptz;
    return;
  end if;

  -- Row locking makes concurrent consumers serialize. Every binding field is
  -- checked before state is exposed, so replay under another action fails.
  select * into v_approval
  from public.real_estate_action_approvals
  where id = p_approval_id
  for update;

  if not found then
    return query select p_approval_id, 'rejected'::text, null::timestamptz;
    return;
  end if;

  if v_approval.organization_id is distinct from p_organization_id
     or v_approval.principal_kind is distinct from p_principal_kind
     or v_approval.principal_id is distinct from btrim(p_principal_id)
     or v_approval.tool_key is distinct from p_tool_key
     or v_approval.arguments_digest is distinct from p_arguments_digest
     or v_approval.session_id is distinct from btrim(p_session_id)
     or v_approval.channel is distinct from p_channel
     or v_approval.token_digest is distinct from p_token_digest then
    return query select p_approval_id, 'rejected'::text, null::timestamptz;
    return;
  end if;

  if v_approval.status = 'consumed' then
    return query select p_approval_id, 'consumed'::text, v_approval.consumed_at;
    return;
  end if;

  if v_approval.status = 'expired' or v_approval.expires_at <= clock_timestamp() then
    update public.real_estate_action_approvals
    set status = 'expired'
    where id = p_approval_id and real_estate_action_approvals.status = 'issued';
    return query select p_approval_id, 'expired'::text, null::timestamptz;
    return;
  end if;

  v_consumed_at := clock_timestamp();
  update public.real_estate_action_approvals
  set status = 'consumed', consumed_at = v_consumed_at
  where id = p_approval_id and real_estate_action_approvals.status = 'issued';

  if not found then
    return query select p_approval_id, 'rejected'::text, null::timestamptz;
    return;
  end if;

  return query select p_approval_id, 'accepted'::text, v_consumed_at;
end;
$$;

revoke all on function public.create_real_estate_action_approval(uuid, uuid, text, text, text, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.consume_real_estate_action_approval(uuid, uuid, text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_real_estate_action_approval(uuid, uuid, text, text, text, text, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.consume_real_estate_action_approval(uuid, uuid, text, text, text, text, text, text, text, boolean) to service_role;

commit;
