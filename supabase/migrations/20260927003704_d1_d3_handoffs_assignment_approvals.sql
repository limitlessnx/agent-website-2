insert into public.permissions(key,description) values
 ('handoffs.view','View tenant human handoff queue'),
 ('handoffs.manage','Assign, claim, resolve and reopen tenant human handoffs'),
 ('approvals.view','View tenant operational approval requests'),
 ('approvals.manage','Approve or reject tenant operational approval requests')
on conflict(key) do update set description=excluded.description;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.key='handoffs.view'
where r.name in ('Owner','Manager','Supervisor','Team Member')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.key='handoffs.manage'
where r.name in ('Owner','Manager','Supervisor')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.key='approvals.view'
where r.name in ('Owner','Manager','Supervisor')
on conflict do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id
from public.roles r
join public.permissions p on p.key='approvals.manage'
where r.name in ('Owner','Manager')
on conflict do nothing;

create table if not exists public.human_handoffs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  conversation_id uuid not null,
  source_system_id uuid,
  source_agent_id uuid,
  correlation_id uuid,
  reason text not null,
  category text not null default 'general',
  priority text not null default 'normal' check(priority in ('low','normal','high','critical')),
  status text not null default 'open' check(status in ('open','assigned','in_progress','waiting_customer','resolved','closed')),
  assigned_membership_id uuid,
  claimed_by_membership_id uuid,
  created_by_type text not null default 'system' check(created_by_type in ('system','agent','human')),
  created_by_id text,
  sla_due_at timestamptz,
  claimed_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  resolution_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,id),
  foreign key(organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade,
  foreign key(organization_id,conversation_id) references public.crm_conversations(organization_id,id) on delete cascade,
  foreign key(organization_id,source_system_id) references public.organization_systems(organization_id,id) on delete set null,
  foreign key(organization_id,source_agent_id) references public.agents(organization_id,id) on delete set null
);

do $$ begin
  alter table public.human_handoffs
  add constraint human_handoffs_assigned_membership_fk
  foreign key(assigned_membership_id) references public.organization_memberships(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.human_handoffs
  add constraint human_handoffs_claimed_membership_fk
  foreign key(claimed_by_membership_id) references public.organization_memberships(id) on delete set null;
exception when duplicate_object then null; end $$;

create index if not exists human_handoffs_queue_idx
  on public.human_handoffs(organization_id,status,priority,created_at);
create index if not exists human_handoffs_assignee_idx
  on public.human_handoffs(organization_id,assigned_membership_id,status);
create index if not exists human_handoffs_sla_idx
  on public.human_handoffs(organization_id,sla_due_at)
  where status not in ('resolved','closed') and sla_due_at is not null;

create table if not exists public.operation_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_type text not null,
  title text not null,
  description text,
  risk_level text not null default 'medium' check(risk_level in ('low','medium','high','critical')),
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','executed','failed')),
  requested_by_type text not null default 'system' check(requested_by_type in ('system','agent','human')),
  requested_by_id text,
  subject_type text,
  subject_id text,
  action_key text not null,
  action_payload jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  required_permission text not null default 'approvals.manage',
  assigned_membership_id uuid references public.organization_memberships(id) on delete set null,
  decided_by_membership_id uuid references public.organization_memberships(id) on delete set null,
  decision_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  expires_at timestamptz,
  executed_at timestamptz,
  result jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,id)
);

create index if not exists operation_approvals_queue_idx
  on public.operation_approvals(organization_id,status,risk_level,requested_at);
create index if not exists operation_approvals_assignee_idx
  on public.operation_approvals(organization_id,assigned_membership_id,status);

alter table public.human_handoffs enable row level security;
alter table public.operation_approvals enable row level security;

revoke all on public.human_handoffs,public.operation_approvals from anon,authenticated;
grant select on public.human_handoffs,public.operation_approvals to authenticated;
grant all on public.human_handoffs,public.operation_approvals to service_role;

create policy human_handoffs_select on public.human_handoffs
for select to authenticated
using(public.has_organization_permission(organization_id,'handoffs.view')
   or public.has_organization_permission(organization_id,'handoffs.manage'));

create policy operation_approvals_select on public.operation_approvals
for select to authenticated
using(public.has_organization_permission(organization_id,'approvals.view')
   or public.has_organization_permission(organization_id,'approvals.manage'));

create or replace function public.create_human_handoff(
  p_organization_id uuid,
  p_customer_id uuid,
  p_conversation_id uuid,
  p_reason text,
  p_category text default 'general',
  p_priority text default 'normal',
  p_source_system_id uuid default null,
  p_source_agent_id uuid default null,
  p_correlation_id uuid default null,
  p_sla_due_at timestamptz default null,
  p_created_by_type text default 'system',
  p_created_by_id text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if not exists(select 1 from public.crm_customers where organization_id=p_organization_id and id=p_customer_id)
  then raise exception 'Customer does not belong to organization'; end if;
  if not exists(select 1 from public.crm_conversations where organization_id=p_organization_id and id=p_conversation_id and customer_id=p_customer_id)
  then raise exception 'Conversation does not belong to customer organization'; end if;

  insert into public.human_handoffs(
    organization_id,customer_id,conversation_id,source_system_id,source_agent_id,correlation_id,
    reason,category,priority,status,sla_due_at,created_by_type,created_by_id,metadata
  ) values(
    p_organization_id,p_customer_id,p_conversation_id,p_source_system_id,p_source_agent_id,p_correlation_id,
    trim(p_reason),coalesce(nullif(trim(p_category),''),'general'),p_priority,'open',p_sla_due_at,
    p_created_by_type,p_created_by_id,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;

  update public.crm_conversations
  set status='waiting',
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('active_handoff_id',v_id,'ai_response_mode','paused_for_handoff'),
      updated_at=now()
  where organization_id=p_organization_id and id=p_conversation_id;

  perform public.add_customer_timeline_event(
    p_organization_id,p_customer_id,'handoff.requested','Human handoff requested',trim(p_reason),
    'internal',p_conversation_id,'human_handoffs',v_id,p_correlation_id,p_created_by_type,p_created_by_id,
    jsonb_build_object('priority',p_priority,'category',p_category),now()
  );

  return v_id;
end $$;

revoke all on function public.create_human_handoff(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb)
from public,anon,authenticated;
grant execute on function public.create_human_handoff(uuid,uuid,uuid,text,text,text,uuid,uuid,uuid,timestamptz,text,text,jsonb)
to service_role;

create or replace function public.claim_human_handoff(p_handoff_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_handoff public.human_handoffs%rowtype;
  v_membership uuid;
begin
  select * into v_handoff from public.human_handoffs where id=p_handoff_id for update;
  if not found then raise exception 'Handoff not found'; end if;
  if not public.has_organization_permission(v_handoff.organization_id,'handoffs.view')
     and not public.has_organization_permission(v_handoff.organization_id,'handoffs.manage')
  then raise exception 'Not authorized to claim handoff'; end if;

  select id into v_membership from public.organization_memberships
  where organization_id=v_handoff.organization_id and user_id=auth.uid() and status='active' limit 1;
  if v_membership is null then raise exception 'Active membership required'; end if;

  if v_handoff.assigned_membership_id is not null and v_handoff.assigned_membership_id<>v_membership
     and not public.has_organization_permission(v_handoff.organization_id,'handoffs.manage')
  then raise exception 'Handoff is assigned to another team member'; end if;

  update public.human_handoffs
  set assigned_membership_id=coalesce(assigned_membership_id,v_membership),
      claimed_by_membership_id=v_membership,status='in_progress',claimed_at=coalesce(claimed_at,now()),updated_at=now()
  where id=p_handoff_id;

  update public.crm_conversations
  set status='human_active',
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('active_handoff_id',p_handoff_id,'ai_response_mode','human_takeover'),
      updated_at=now()
  where organization_id=v_handoff.organization_id and id=v_handoff.conversation_id;

  return jsonb_build_object('handoff_id',p_handoff_id,'status','in_progress','membership_id',v_membership);
end $$;

revoke all on function public.claim_human_handoff(uuid) from public,anon,authenticated;
grant execute on function public.claim_human_handoff(uuid) to authenticated,service_role;

create or replace function public.assign_human_handoff(p_handoff_id uuid,p_membership_id uuid)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_handoff public.human_handoffs%rowtype;
begin
  select * into v_handoff from public.human_handoffs where id=p_handoff_id for update;
  if not found then raise exception 'Handoff not found'; end if;
  if not public.has_organization_permission(v_handoff.organization_id,'handoffs.manage')
  then raise exception 'handoffs.manage required'; end if;
  if not exists(select 1 from public.organization_memberships where id=p_membership_id and organization_id=v_handoff.organization_id and status='active')
  then raise exception 'Assignee must be an active member of organization'; end if;

  update public.human_handoffs
  set assigned_membership_id=p_membership_id,
      status=case when status='open' then 'assigned' else status end,
      updated_at=now()
  where id=p_handoff_id;

  return jsonb_build_object('handoff_id',p_handoff_id,'assigned_membership_id',p_membership_id,'status','assigned');
end $$;

revoke all on function public.assign_human_handoff(uuid,uuid) from public,anon,authenticated;
grant execute on function public.assign_human_handoff(uuid,uuid) to authenticated,service_role;

create or replace function public.resolve_human_handoff(p_handoff_id uuid,p_resolution_summary text,p_resume_ai boolean default true)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_handoff public.human_handoffs%rowtype; v_membership uuid;
begin
  select * into v_handoff from public.human_handoffs where id=p_handoff_id for update;
  if not found then raise exception 'Handoff not found'; end if;
  select id into v_membership from public.organization_memberships
  where organization_id=v_handoff.organization_id and user_id=auth.uid() and status='active' limit 1;
  if v_membership is null then raise exception 'Active membership required'; end if;
  if v_handoff.claimed_by_membership_id<>v_membership
     and v_handoff.assigned_membership_id<>v_membership
     and not public.has_organization_permission(v_handoff.organization_id,'handoffs.manage')
  then raise exception 'Only assignee, claimant, or handoff manager can resolve'; end if;

  update public.human_handoffs
  set status='resolved',resolved_at=now(),resolution_summary=nullif(trim(p_resolution_summary),''),updated_at=now()
  where id=p_handoff_id;

  update public.crm_conversations
  set status=case when p_resume_ai then 'ai_active' else 'resolved' end,
      metadata=(coalesce(metadata,'{}'::jsonb)-'active_handoff_id')||
        jsonb_build_object('ai_response_mode',case when p_resume_ai then 'active' else 'stopped' end,'last_resolved_handoff_id',p_handoff_id),
      updated_at=now()
  where organization_id=v_handoff.organization_id and id=v_handoff.conversation_id;

  perform public.add_customer_timeline_event(
    v_handoff.organization_id,v_handoff.customer_id,'handoff.resolved','Human handoff resolved',
    nullif(trim(p_resolution_summary),''),'internal',v_handoff.conversation_id,'human_handoffs',v_handoff.id,
    v_handoff.correlation_id,'human',v_membership::text,jsonb_build_object('resume_ai',p_resume_ai),now()
  );

  return jsonb_build_object('handoff_id',p_handoff_id,'status','resolved','resume_ai',p_resume_ai);
end $$;

revoke all on function public.resolve_human_handoff(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.resolve_human_handoff(uuid,text,boolean) to authenticated,service_role;

create or replace function public.request_operation_approval(
  p_organization_id uuid,
  p_approval_type text,
  p_title text,
  p_action_key text,
  p_action_payload jsonb default '{}'::jsonb,
  p_description text default null,
  p_risk_level text default 'medium',
  p_subject_type text default null,
  p_subject_id text default null,
  p_preview jsonb default '{}'::jsonb,
  p_requested_by_type text default 'system',
  p_requested_by_id text default null,
  p_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  insert into public.operation_approvals(
    organization_id,approval_type,title,description,risk_level,status,requested_by_type,requested_by_id,
    subject_type,subject_id,action_key,action_payload,preview,expires_at,metadata
  ) values(
    p_organization_id,trim(p_approval_type),trim(p_title),p_description,p_risk_level,'pending',
    p_requested_by_type,p_requested_by_id,p_subject_type,p_subject_id,trim(p_action_key),
    coalesce(p_action_payload,'{}'::jsonb),coalesce(p_preview,'{}'::jsonb),p_expires_at,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.request_operation_approval(uuid,text,text,text,jsonb,text,text,text,text,jsonb,text,text,timestamptz,jsonb)
from public,anon,authenticated;
grant execute on function public.request_operation_approval(uuid,text,text,text,jsonb,text,text,text,text,jsonb,text,text,timestamptz,jsonb)
to service_role;

create or replace function public.decide_operation_approval(p_approval_id uuid,p_decision text,p_reason text default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v public.operation_approvals%rowtype; v_membership uuid;
begin
  select * into v from public.operation_approvals where id=p_approval_id for update;
  if not found then raise exception 'Approval not found'; end if;
  if v.status<>'pending' then raise exception 'Approval is no longer pending'; end if;
  if v.expires_at is not null and v.expires_at<=now() then raise exception 'Approval request has expired'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if not public.has_organization_permission(v.organization_id,'approvals.manage')
  then raise exception 'approvals.manage required'; end if;
  select id into v_membership from public.organization_memberships
  where organization_id=v.organization_id and user_id=auth.uid() and status='active' limit 1;
  if v_membership is null then raise exception 'Active membership required'; end if;
  if v.requested_by_type='human' and v.requested_by_id=v_membership::text
  then raise exception 'Requester cannot self-approve'; end if;

  update public.operation_approvals
  set status=p_decision,decided_by_membership_id=v_membership,decision_reason=nullif(trim(p_reason),''),
      decided_at=now(),updated_at=now()
  where id=p_approval_id;

  insert into public.audit_logs(organization_id,action,resource_type,resource_id,reason,metadata)
  values(v.organization_id,'operation_approval.'||p_decision,'operation_approval',p_approval_id::text,
         nullif(trim(p_reason),''),jsonb_build_object('membership_id',v_membership,'action_key',v.action_key,'risk_level',v.risk_level));

  return jsonb_build_object('approval_id',p_approval_id,'status',p_decision,'decided_by_membership_id',v_membership);
end $$;

revoke all on function public.decide_operation_approval(uuid,text,text) from public,anon,authenticated;
grant execute on function public.decide_operation_approval(uuid,text,text) to authenticated,service_role;
