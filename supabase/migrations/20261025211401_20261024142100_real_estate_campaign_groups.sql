begin;

create table public.real_estate_campaign_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  group_type text not null check (group_type in ('manual','smart')),
  description text not null default '',
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules)='object'),
  created_by text not null check (length(btrim(created_by)) between 1 and 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  check (group_type<>'manual' or rules='{}'::jsonb),
  check (group_type<>'smart' or rules<>'{}'::jsonb)
);

create table public.real_estate_campaign_group_members (
  organization_id uuid not null,
  group_id uuid not null,
  lead_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id,group_id,lead_id),
  foreign key (organization_id,group_id)
    references public.real_estate_campaign_groups(organization_id,id) on delete cascade,
  foreign key (organization_id,lead_id)
    references public.leads(organization_id,id) on delete cascade
);

create index real_estate_campaign_groups_org_updated_idx
  on public.real_estate_campaign_groups(organization_id,updated_at desc);
create index real_estate_campaign_group_members_org_lead_idx
  on public.real_estate_campaign_group_members(organization_id,lead_id);
create trigger set_real_estate_campaign_groups_updated_at
before update on public.real_estate_campaign_groups
for each row execute function public.set_updated_at();

alter table public.real_estate_campaign_groups enable row level security;
alter table public.real_estate_campaign_group_members enable row level security;
revoke all on public.real_estate_campaign_groups,public.real_estate_campaign_group_members from public,anon,authenticated;
grant select on public.real_estate_campaign_groups,public.real_estate_campaign_group_members to authenticated;
grant all on public.real_estate_campaign_groups,public.real_estate_campaign_group_members to service_role;

create policy real_estate_campaign_groups_member_select
on public.real_estate_campaign_groups for select to authenticated
using (public.is_organization_member(organization_id));
create policy real_estate_campaign_group_members_member_select
on public.real_estate_campaign_group_members for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.save_real_estate_campaign_group_with_audit(
  p_organization_id uuid,
  p_actor_id text,
  p_group_id uuid,
  p_name text,
  p_group_type text,
  p_description text,
  p_rules jsonb,
  p_lead_ids uuid[]
) returns public.real_estate_campaign_groups
language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  v_group public.real_estate_campaign_groups%rowtype;
  v_lead_ids uuid[]:=coalesce(p_lead_ids,'{}'::uuid[]);
  v_count integer;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if length(btrim(coalesce(p_name,''))) not between 1 and 160 then raise exception 'Campaign group name must be 1-160 characters'; end if;
  if p_group_type not in ('manual','smart') then raise exception 'Invalid campaign group type'; end if;
  if jsonb_typeof(coalesce(p_rules,'{}'::jsonb))<>'object' then raise exception 'Campaign group rules must be an object'; end if;
  if cardinality(v_lead_ids)>10000 or array_position(v_lead_ids,null) is not null then raise exception 'Campaign group lead selection is invalid'; end if;
  if p_group_type='manual' and jsonb_strip_nulls(coalesce(p_rules,'{}'::jsonb))<>'{}'::jsonb then raise exception 'Manual campaign groups cannot contain smart rules'; end if;
  if p_group_type='smart' and cardinality(v_lead_ids)>0 then raise exception 'Smart campaign groups cannot contain pinned leads'; end if;
  if p_group_type='smart' and coalesce(p_rules,'{}'::jsonb)='{}'::jsonb then raise exception 'Smart campaign groups require at least one rule'; end if;
  if p_group_type='manual' and cardinality(v_lead_ids)=0 then raise exception 'Manual campaign groups must include at least one CRM lead'; end if;
  if exists (
    select 1 from unnest(v_lead_ids) requested(lead_id)
    where not exists (select 1 from public.leads l where l.organization_id=p_organization_id and l.id=requested.lead_id)
  ) then raise exception 'Every campaign group member must be a lead in this organization'; end if;

  if p_group_id is null then
    insert into public.real_estate_campaign_groups(organization_id,name,group_type,description,rules,created_by)
    values(p_organization_id,btrim(p_name),p_group_type,btrim(coalesce(p_description,'')),coalesce(p_rules,'{}'::jsonb),btrim(p_actor_id))
    returning * into v_group;
  else
    update public.real_estate_campaign_groups g set
      name=btrim(p_name),group_type=p_group_type,description=btrim(coalesce(p_description,'')),
      rules=coalesce(p_rules,'{}'::jsonb),created_by=btrim(p_actor_id)
    where g.organization_id=p_organization_id and g.id=p_group_id returning g.* into v_group;
    if not found then raise exception 'Campaign group was not found in this organization'; end if;
  end if;

  delete from public.real_estate_campaign_group_members m
  where m.organization_id=p_organization_id and m.group_id=v_group.id;
  if p_group_type='manual' then
    insert into public.real_estate_campaign_group_members(organization_id,group_id,lead_id)
    select p_organization_id,v_group.id,member_id from unnest(v_lead_ids) member_id;
  end if;
  select count(*) into v_count from public.real_estate_campaign_group_members where organization_id=p_organization_id and group_id=v_group.id;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,'real_estate.campaign_group.saved','real_estate_campaign_group',v_group.id::text,
    jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_campaign_dashboard','group_type',p_group_type,'member_count',v_count));
  return v_group;
end;
$$;

create or replace function public.delete_real_estate_campaign_group_with_audit(
  p_organization_id uuid,p_actor_id text,p_group_id uuid
) returns uuid
language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_group_id uuid;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  delete from public.real_estate_campaign_groups g
  where g.organization_id=p_organization_id and g.id=p_group_id returning g.id into v_group_id;
  if not found then raise exception 'Campaign group was not found in this organization'; end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,'real_estate.campaign_group.deleted','real_estate_campaign_group',v_group_id::text,
    jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_campaign_dashboard'));
  return v_group_id;
end;
$$;

revoke all on function public.save_real_estate_campaign_group_with_audit(uuid,text,uuid,text,text,text,jsonb,uuid[]) from public,anon,authenticated;
revoke all on function public.delete_real_estate_campaign_group_with_audit(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.save_real_estate_campaign_group_with_audit(uuid,text,uuid,text,text,text,jsonb,uuid[]) to service_role;
grant execute on function public.delete_real_estate_campaign_group_with_audit(uuid,text,uuid) to service_role;

commit;
