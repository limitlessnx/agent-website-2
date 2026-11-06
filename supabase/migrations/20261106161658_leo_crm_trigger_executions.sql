-- Internal execution evidence. No browser roles may read approval tokens or actions.
create table public.leo_crm_approvals (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  principal text not null,
  session_id text not null,
  channel text not null check (channel in ('chat','voice','api')),
  action_digest text not null,
  token_digest text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  execution_id uuid unique,
  created_at timestamptz not null default now()
);
create table public.leo_crm_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  approval_id uuid not null unique references public.leo_crm_approvals(id),
  principal text not null,
  session_id text not null,
  channel text not null check (channel in ('chat','voice','api')),
  identity jsonb not null,
  arguments jsonb not null,
  action_digest text not null,
  status text not null default 'pending_dispatch' check (status in ('pending_dispatch','queued','processing','sending','completed','failed','unknown')),
  authorized_until timestamptz not null,
  provider_run_id text,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (arguments->>'organization_id' = organization_id::text),
  check (status <> 'completed' or coalesce(result->>'delivery_status' = 'provider_accepted' and nullif(result->>'providerMessageId','') is not null, false))
);
alter table public.leo_crm_approvals add constraint leo_crm_approval_execution_fk foreign key (execution_id) references public.leo_crm_executions(id);
create index leo_crm_executions_tenant_created on public.leo_crm_executions(organization_id,created_at desc);
alter table public.leo_crm_approvals enable row level security;
alter table public.leo_crm_executions enable row level security;
revoke all on public.leo_crm_approvals, public.leo_crm_executions from public, anon, authenticated;
grant select, insert, update on public.leo_crm_approvals, public.leo_crm_executions to service_role;
create policy leo_crm_approvals_service on public.leo_crm_approvals to service_role using (true) with check (true);
create policy leo_crm_executions_service on public.leo_crm_executions to service_role using (true) with check (true);

-- Approval consumption and durable execution creation are a single transaction.
-- A consumed approval only returns its original execution, even beyond broker TTL.
create function public.accept_leo_crm_execution(
  p_approval_id uuid, p_token_digest text, p_organization_id uuid, p_principal text,
  p_session_id text, p_channel text, p_action_digest text, p_arguments jsonb, p_identity jsonb
) returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare a public.leo_crm_approvals; e public.leo_crm_executions;
begin
  select * into a from public.leo_crm_approvals where id=p_approval_id for update;
  if not found or a.token_digest is distinct from p_token_digest or a.organization_id is distinct from p_organization_id
    or a.principal is distinct from p_principal or a.session_id is distinct from p_session_id
    or a.channel is distinct from p_channel or a.action_digest is distinct from p_action_digest then
    raise exception 'CRM approval does not match this action';
  end if;
  if a.execution_id is not null then
    select * into strict e from public.leo_crm_executions where id=a.execution_id;
    if e.arguments is distinct from p_arguments then raise exception 'CRM execution arguments changed'; end if;
    return to_jsonb(e);
  end if;
  if a.consumed_at is not null or a.expires_at <= now() then raise exception 'CRM approval expired or consumed'; end if;
  if p_arguments->>'organization_id' is distinct from p_organization_id::text then raise exception 'CRM tenant mismatch'; end if;
  insert into public.leo_crm_executions(organization_id,approval_id,principal,session_id,channel,identity,arguments,action_digest,authorized_until)
    values(p_organization_id,p_approval_id,p_principal,p_session_id,p_channel,p_identity,p_arguments,p_action_digest,now()+interval '15 minutes') returning * into e;
  update public.leo_crm_approvals set consumed_at=now(),execution_id=e.id where id=a.id;
  return to_jsonb(e);
end;
$$;
revoke all on function public.accept_leo_crm_execution(uuid,text,uuid,text,text,text,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.accept_leo_crm_execution(uuid,text,uuid,text,text,text,text,jsonb,jsonb) to service_role;
