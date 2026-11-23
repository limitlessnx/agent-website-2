begin;

-- Presentation and contact classification stay in the existing Gencouv tables.
-- Neither function enrolls recipients, changes consent, or sends email.
create or replace function public.gencouv_update_contact_stage(p_organization_id uuid,p_email text,p_action text,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_email text:=lower(btrim(p_email)); v_patch jsonb; v_count integer:=0; v_rows integer;
begin
  if p_organization_id is distinct from '05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid or length(btrim(coalesce(p_actor,'')))<3 then raise exception 'Gencouv actor required'; end if;
  if v_email is null or v_email!~'^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$' then raise exception 'Invalid contact'; end if;
  v_patch:=case p_action
    when 'mark_hot' then '{"lead_temperature":"hot"}'::jsonb
    when 'mark_warm' then '{"lead_temperature":"warm"}'::jsonb
    when 'mark_cold' then '{"lead_temperature":"cold"}'::jsonb
    when 'move_following_up' then '{"pipeline_stage":"following_up"}'::jsonb
    when 'move_onboarding' then '{"pipeline_stage":"onboarding"}'::jsonb
    when 'do_not_contact' then '{"do_not_contact":true}'::jsonb
    else null end;
  if v_patch is null then raise exception 'Unsupported contact action'; end if;
  perform pg_advisory_xact_lock(hashtext('gencouv_contact'),hashtext(p_organization_id::text||v_email));
  update public.crm_customers set metadata=coalesce(metadata,'{}'::jsonb)||v_patch,updated_at=now()
    where organization_id=p_organization_id and lower(btrim(email))=v_email;
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  update public.gencouv_qualified_leads set metadata=coalesce(metadata,'{}'::jsonb)||v_patch,
    do_not_contact=case when p_action='do_not_contact' then true else do_not_contact end,updated_at=now()
    where organization_id=p_organization_id and normalized_email=v_email;
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  if v_count=0 then raise exception 'Contact not found'; end if;
  if p_action='do_not_contact' then
    insert into public.gencouv_suppression_list(organization_id,normalized_email,reason,source)
      values(p_organization_id,v_email,'manual_do_not_contact','dashboard')
      on conflict(organization_id,normalized_email) do update set reason=excluded.reason,source=excluded.source,updated_at=now();
    update public.gencouv_campaign_enrollments set do_not_contact=true,updated_at=now()
      where organization_id=p_organization_id and normalized_email=v_email;
  end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,'gencouv.contact_stage_updated','gencouv_contact',v_email,
      jsonb_build_object('actor_email',p_actor,'stage_action',p_action,'outcome','saved','email_requested',false));
  return jsonb_build_object('success',true,'message',case when p_action='do_not_contact' then 'Contact suppressed from future outbound email.' else 'Contact classification saved. No sequence was activated or email sent.' end);
end;
$$;

create or replace function public.gencouv_dashboard_snapshot(p_organization_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare v_result jsonb;
begin
  if p_organization_id is distinct from '05737e03-f8f0-4202-8e9b-0a8982a1091c'::uuid then raise exception 'Gencouv workspace required'; end if;
  with sources as (
    select c.id::text as lead_id,lower(btrim(c.email)) as email,c.full_name as name,c.phone,
      coalesce(c.metadata->>'source','crm') as source,c.metadata,
      c.metadata->>'lifecycle_status' as lifecycle_status,c.metadata->>'product_interest' as product_interest,
      c.metadata->>'broker' as broker,null::text as email_sequence_status,null::timestamptz as last_contact_at,
      null::timestamptz as next_follow_up_at,c.created_at,0 as priority
    from public.crm_customers c where c.organization_id=p_organization_id and c.status not in ('blocked','archived')
      and coalesce(c.metadata->>'do_not_contact','false')<>'true'
    union all
    select q.id::text,q.normalized_email,q.full_name,q.phone,q.source,coalesce(q.metadata,'{}'::jsonb),
      q.lifecycle_status,q.product_interest,q.broker,q.email_sequence_status,q.last_email_sent_at,q.next_follow_up_at,q.created_at,1
    from public.gencouv_qualified_leads q where q.organization_id=p_organization_id and not coalesce(q.do_not_contact,false)
      and coalesce(q.suppression_status,'') not in ('suppressed','blocked') and coalesce(q.unsubscribe_status,'')<>'unsubscribed'
  ), contacts as (
    select distinct on(email) * from sources s where email~'^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$'
      and not exists(select 1 from public.gencouv_suppression_list x where x.organization_id=p_organization_id and x.normalized_email=s.email)
      -- A blocked CRM identity also blocks an otherwise visible qualified copy.
      and not exists(select 1 from public.crm_customers c where c.organization_id=p_organization_id and lower(btrim(c.email))=s.email and (c.status in ('blocked','archived') or c.metadata->>'do_not_contact'='true'))
    order by email,priority,created_at desc
  ), leads as (
    select *,coalesce(metadata->>'pipeline_stage',lower(lifecycle_status),'new') as pipeline_stage,
      coalesce(metadata->>'lead_temperature','unclassified') as lead_temperature,
      jsonb_build_object('lead_id',lead_id,'email',email,'name',name,'phone',phone,'source',source,
        'lifecycle_status',lifecycle_status,'product_interest',product_interest,'broker',broker,
        'pipeline_stage',coalesce(metadata->>'pipeline_stage',lower(lifecycle_status),'new'),
        'lead_temperature',metadata->>'lead_temperature','email_sequence_status',email_sequence_status,
        'last_contact_at',last_contact_at,'next_follow_up_at',next_follow_up_at) as item
    from contacts
  ), settings as (
    select sending_enabled and status='active' as enabled,daily_send_limit from public.gencouv_campaign_settings
    where organization_id=p_organization_id and campaign_key='gencouv_long_form_copy_trading'
  )
  select jsonb_build_object('success',true,'source','supabase','generated_at',now(),
    'totals',jsonb_build_object('contacts',(select count(*) from leads),'onboarding',(select count(*) from leads where pipeline_stage='onboarding'),'onboarded',(select count(*) from leads where pipeline_stage='onboarded')),
    'recent_leads',coalesce((select jsonb_agg(item order by created_at desc,email) from (select * from leads order by created_at desc,email limit 200) r),'[]'::jsonb),
    'lead_boards',jsonb_build_object('hot',coalesce((select jsonb_agg(item order by created_at desc,email) from (select * from leads where lead_temperature='hot' order by created_at desc,email limit 4) h),'[]'::jsonb)),
    'breakdowns',jsonb_build_object(
      'lifecycle_status',coalesce((select jsonb_object_agg(label,n) from (select pipeline_stage as label,count(*) as n from leads group by pipeline_stage) b),'{}'::jsonb),
      'source',coalesce((select jsonb_object_agg(label,n) from (select coalesce(source,'unknown') as label,count(*) as n from leads group by coalesce(source,'unknown')) b),'{}'::jsonb),
      'broker',coalesce((select jsonb_object_agg(label,n) from (select coalesce(broker,'unassigned') as label,count(*) as n from leads group by coalesce(broker,'unassigned')) b),'{}'::jsonb),
      'email_sequence_status',coalesce((select jsonb_object_agg(label,n) from (select coalesce(email_sequence_status,'not_enrolled') as label,count(*) as n from leads group by coalesce(email_sequence_status,'not_enrolled')) b),'{}'::jsonb)),
    'email_controls',jsonb_build_object('sending_enabled',coalesce((select enabled from settings),false),'daily_send_limit',(select daily_send_limit from settings)),
    'warnings',jsonb_build_object('email_sending_enabled',coalesce((select enabled from settings),false),'note','Live database overview. Contact classification does not activate automated email.')) into v_result;
  return v_result;
end;
$$;

revoke all on function public.gencouv_update_contact_stage(uuid,text,text,text),public.gencouv_dashboard_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.gencouv_update_contact_stage(uuid,text,text,text),public.gencouv_dashboard_snapshot(uuid) to service_role;
commit;
