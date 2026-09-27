create or replace function public.timeline_from_crm_lead() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  perform public.add_customer_timeline_event(
    new.organization_id,
    new.customer_id,
    'lead.'||new.stage,
    'Lead '||replace(new.stage,'_',' '),
    coalesce(new.summary,'Lead stage updated'),
    coalesce(new.source,'crm'),
    null,
    'crm_leads',
    new.id,
    null,
    'system',
    coalesce(new.assigned_agent_id::text,null),
    jsonb_build_object('score',new.score,'value_estimate',new.value_estimate,'currency',new.currency),
    new.updated_at
  );
  return new;
end $$;

drop trigger if exists crm_lead_customer_timeline on public.crm_leads;
create trigger crm_lead_customer_timeline
after insert or update of stage,score,summary
on public.crm_leads
for each row execute function public.timeline_from_crm_lead();

create or replace function public.timeline_from_domain_event() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.customer_id is not null then
    perform public.add_customer_timeline_event(
      new.organization_id,
      new.customer_id,
      'system.'||new.event_type,
      replace(initcap(replace(new.event_type,'.',' ')),'_',' '),
      left(coalesce(new.payload->>'message',new.payload->>'reason',new.event_type),500),
      new.source,
      new.conversation_id,
      'domain_events',
      new.id,
      new.correlation_id,
      'system',
      coalesce(new.source_system_id::text,null),
      jsonb_build_object(
        'event_type',new.event_type,
        'status',new.status,
        'source_system_id',new.source_system_id,
        'target_system_id',new.target_system_id
      ),
      new.created_at
    );
  end if;
  return new;
end $$;

drop trigger if exists domain_event_customer_timeline on public.domain_events;
create trigger domain_event_customer_timeline
after insert on public.domain_events
for each row execute function public.timeline_from_domain_event();
