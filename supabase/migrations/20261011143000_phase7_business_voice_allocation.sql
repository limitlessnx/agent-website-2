begin;

-- Phase 7: move Voice into Business and keep Email/Web Chat in Business+.
-- Existing organizations retain their plan, but invalid selected channels are paused.
update public.organization_plan_allocations
set
  max_channels = case plan_code when 'basic' then 1 when 'plus' then 1 when 'business' then 2 else 4 end,
  selectable_channels = case plan_code
    when 'basic' then array['whatsapp']::text[]
    when 'plus' then array['whatsapp']::text[]
    when 'business' then array['whatsapp','voice']::text[]
    else array['web_chat','whatsapp','voice','email']::text[]
  end,
  selected_channels = (
    select coalesce(array_agg(channel order by channel), '{}'::text[])
    from unnest(selected_channels) as selected(channel)
    where channel = any(case plan_code
      when 'basic' then array['whatsapp']::text[]
      when 'plus' then array['whatsapp']::text[]
      when 'business' then array['whatsapp','voice']::text[]
      else array['web_chat','whatsapp','voice','email']::text[]
    end)
  ),
  updated_at = now();

update public.organization_channel_allocations c
set status = 'paused', updated_at = now(), setup_metadata = coalesce(c.setup_metadata, '{}'::jsonb) || jsonb_build_object('paused_by', 'phase7_plan_correction')
from public.organization_plan_allocations a
where c.allocation_id = a.id
  and (not (c.channel = any(a.selectable_channels)) or not (c.channel = any(a.selected_channels)))
  and c.status <> 'paused';

create or replace function public.sync_organization_plan_allocation(
  p_organization_id uuid,
  p_plan_code text,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_credits integer;
  v_max_channels integer;
  v_selectable text[];
  v_allocation public.organization_plan_allocations%rowtype;
  v_selected text[];
begin
  if p_organization_id is null then raise exception 'organization_id is required'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then raise exception 'Organization does not exist'; end if;

  v_plan := case lower(coalesce(p_plan_code,''))
    when 'plus' then 'plus'
    when 'business' then 'business'
    when 'business_plus' then 'business_plus'
    when 'business-plus' then 'business_plus'
    else 'basic'
  end;
  v_credits := case v_plan when 'plus' then 5000 when 'business' then 12000 when 'business_plus' then 25000 else 2500 end;
  v_max_channels := case v_plan when 'basic' then 1 when 'plus' then 1 when 'business' then 2 else 4 end;
  v_selectable := case v_plan
    when 'basic' then array['whatsapp']::text[]
    when 'plus' then array['whatsapp']::text[]
    when 'business' then array['whatsapp','voice']::text[]
    else array['web_chat','whatsapp','voice','email']::text[]
  end;

  select * into v_allocation from public.organization_plan_allocations where organization_id = p_organization_id for update;
  v_selected := coalesce(v_allocation.selected_channels, '{}'::text[]);
  v_selected := array(select channel from unnest(v_selected) as channel where channel = any(v_selectable) limit v_max_channels);

  insert into public.organization_plan_allocations (
    organization_id, plan_code, monthly_credit_allowance, max_channels, selectable_channels, selected_channels,
    setup_status, allocation_status, configured_by, metadata
  ) values (
    p_organization_id, v_plan, v_credits, v_max_channels, v_selectable, v_selected,
    coalesce(v_allocation.setup_status, 'pending'),
    case when cardinality(v_selected) > 0 then coalesce(v_allocation.allocation_status, 'pending') else 'pending' end,
    p_actor_user_id, coalesce(v_allocation.metadata, '{}'::jsonb) || jsonb_build_object('last_synced_by','plan_sync')
  )
  on conflict (organization_id) do update set
    plan_code = excluded.plan_code, monthly_credit_allowance = excluded.monthly_credit_allowance,
    max_channels = excluded.max_channels, selectable_channels = excluded.selectable_channels,
    selected_channels = excluded.selected_channels,
    configured_by = coalesce(excluded.configured_by, public.organization_plan_allocations.configured_by),
    metadata = public.organization_plan_allocations.metadata || excluded.metadata, updated_at = now()
  returning * into v_allocation;

  update public.organization_channel_allocations
  set status = 'paused', updated_at = now()
  where allocation_id = v_allocation.id and not (channel = any(v_selected)) and status <> 'paused';

  insert into public.organization_entitlements (organization_id, feature_key, enabled, source, limit_value, configuration)
  values
    (p_organization_id, 'plan.channels.max', true, 'plan', v_max_channels, jsonb_build_object('plan_code',v_plan)),
    (p_organization_id, 'plan.flux_credits.monthly', true, 'plan', v_credits, jsonb_build_object('plan_code',v_plan))
  on conflict (organization_id, feature_key) do update set
    enabled = excluded.enabled, source = 'plan', limit_value = excluded.limit_value,
    configuration = excluded.configuration, updated_at = now();

  return public.organization_plan_allocation_snapshot(p_organization_id);
end;
$$;

revoke all on function public.sync_organization_plan_allocation(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.sync_organization_plan_allocation(uuid,text,uuid) to service_role;

commit;
