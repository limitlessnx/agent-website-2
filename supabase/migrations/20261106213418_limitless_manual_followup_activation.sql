begin;

create or replace function public.normalize_limitless_manual_followup_phone(p_phone text)
returns text language sql immutable strict set search_path = pg_catalog, public
as $function$
  with raw as (select regexp_replace(trim(p_phone), '[^0-9]', '', 'g') as phone),
  international as (select case when phone like '00%' then substring(phone from 3) else phone end as phone from raw)
  select case when phone like '2340%' and length(phone)=14 then '234'||substring(phone from 5)
    when phone like '0%' and length(phone)=11 then '234'||substring(phone from 2) else phone end from international;
$function$;

create or replace function public.activate_limitless_manual_followup(
  p_organization_id uuid, p_lead_id uuid, p_property_id uuid,
  p_reason text, p_notes text, p_actor text, p_consent_confirmed boolean, p_steps jsonb
) returns jsonb language plpgsql security definer set search_path = pg_catalog, public
as $function$
declare
  v_lead public.leads%rowtype;
  v_contact public.tenant_customer_contacts%rowtype;
  v_sequence public.limitless_maia_followup_sequences%rowtype;
  v_phone text;
  v_matches integer;
  v_result jsonb;
  v_step public.follow_ups%rowtype;
  v_now timestamptz := now();
begin
  if p_organization_id is distinct from 'b15f21b4-5697-4d21-9421-8a34eae3476d'::uuid
    or p_lead_id is null or p_property_id is null or nullif(trim(p_actor),'') is null
    or nullif(trim(p_reason),'') is null or length(p_reason)>2000 or length(coalesce(p_notes,''))>4000
    or p_consent_confirmed is distinct from true then
    raise exception 'An exact Limitless lead/property, reason, actor and confirmed customer permission are required.';
  end if;
  if not exists(select 1 from public.organizations where id=p_organization_id and status='active' and slug='limitless-realty') then
    raise exception 'The active Limitless Realty organization is required.';
  end if;
  perform 1 from public.properties where organization_id=p_organization_id and id=p_property_id;
  if not found then raise exception 'The selected property was not found in Limitless Realty.'; end if;
  select * into v_lead from public.leads where organization_id=p_organization_id and id=p_lead_id for update;
  if not found then raise exception 'The selected lead was not found in Limitless Realty.'; end if;
  if coalesce(v_lead.opted_out,false) or v_lead.status='opted_out' then
    raise exception 'This customer has opted out. Manual activation cannot override an opt-out.';
  end if;
  v_phone := public.normalize_limitless_manual_followup_phone(v_lead.phone);
  if v_phone is null or v_phone !~ '^[1-9][0-9]{7,14}$' then raise exception 'A valid customer WhatsApp phone number is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||v_phone,0));
  select count(*) into v_matches from public.leads where organization_id=p_organization_id
    and public.normalize_limitless_manual_followup_phone(phone)=v_phone;
  if v_matches<>1 then raise exception 'This phone matches multiple leads. Resolve the customer identity before activation.'; end if;
  select count(*) into v_matches from public.tenant_customer_contacts where organization_id=p_organization_id
    and public.normalize_limitless_manual_followup_phone(phone)=v_phone;
  if v_matches>1 then raise exception 'This phone matches multiple customer contacts. Resolve the identity before activation.'; end if;
  select * into v_contact from public.tenant_customer_contacts where organization_id=p_organization_id
    and public.normalize_limitless_manual_followup_phone(phone)=v_phone for update;
  if found and v_contact.whatsapp_consent='opted_out' then
    raise exception 'This customer has opted out. Manual activation cannot override an opt-out.';
  end if;
  if v_contact.id is not null then
    select * into v_sequence from public.limitless_maia_followup_sequences where organization_id=p_organization_id
      and customer_id=v_contact.id and property_id=p_property_id and sequence_key='maia_limitless_property_sales_followup_v1'
      and status in ('active','paused') for update;
    if found then
      if v_sequence.status='paused' then raise exception 'A paused follow-up already exists. Resume it in Follow-up Control.'; end if;
      if v_sequence.consent_state<>'opted_in' or v_sequence.lead_id is distinct from p_lead_id then
        raise exception 'The existing follow-up requires consent or identity review.';
      end if;
      select * into v_step from public.follow_ups where organization_id=p_organization_id and sequence_id=v_sequence.id order by stage limit 1;
      return jsonb_build_object('created',false,'status','active','sequence_id',v_sequence.id,'first_step_id',v_step.id,'first_due_at',v_step.scheduled_at,'first_step_status',v_step.status);
    end if;
    select * into v_sequence from public.limitless_maia_followup_sequences where organization_id=p_organization_id
      and customer_id=v_contact.id and property_id=p_property_id order by created_at desc limit 1;
    if found and (v_sequence.status='opted_out' or v_sequence.consent_state='opted_out') then
      raise exception 'An opted-out follow-up requires renewed customer consent through the normal consent flow.';
    end if;
  end if;
  if v_contact.id is null then
    insert into public.tenant_customer_contacts(organization_id,full_name,phone,whatsapp_consent,consent_source,consent_recorded_at,source)
    values(p_organization_id,left(coalesce(nullif(trim(v_lead.name),''),v_phone),180),v_phone,'opted_in','manual_followup_confirmation',v_now,'manual') returning * into v_contact;
  else
    update public.tenant_customer_contacts set whatsapp_consent='opted_in',consent_source='manual_followup_confirmation',
      consent_recorded_at=v_now,updated_at=v_now where organization_id=p_organization_id and id=v_contact.id;
  end if;
  -- Reuse the canonical six-step enrollment transaction and its duplicate/tenant guards.
  select jsonb_agg(case when (s->>'stage')::integer=1 then s||jsonb_build_object('scheduled_at',v_now,'due_at',v_now) else s end)
    into p_steps from jsonb_array_elements(p_steps) s;
  v_result := public.create_limitless_maia_followup_sequence(p_organization_id,v_contact.id,p_lead_id,p_property_id,
    gen_random_uuid(),'maia_limitless_property_sales_followup_v1',v_now,'manual_followup_confirmation',trim(p_actor),false,p_steps);
  insert into public.limitless_maia_followup_events(organization_id,customer_id,lead_id,property_id,sequence_id,event_type,source,actor,reason,metadata)
  values(p_organization_id,v_contact.id,p_lead_id,p_property_id,(v_result->>'sequence_id')::uuid,'manual_activation',
    'leads_workspace',trim(p_actor),trim(p_reason),jsonb_build_object('notes',coalesce(p_notes,''),'first_step_due_immediately',true));
  select * into v_step from public.follow_ups where organization_id=p_organization_id and sequence_id=(v_result->>'sequence_id')::uuid order by stage limit 1;
  return jsonb_build_object('created',true,'status','active','sequence_id',v_result->>'sequence_id','first_step_id',v_step.id,'first_due_at',v_step.scheduled_at,'first_step_status',v_step.status);
end;
$function$;

revoke all on function public.normalize_limitless_manual_followup_phone(text) from public,anon,authenticated;
revoke all on function public.activate_limitless_manual_followup(uuid,uuid,uuid,text,text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.normalize_limitless_manual_followup_phone(text) to service_role;
grant execute on function public.activate_limitless_manual_followup(uuid,uuid,uuid,text,text,text,boolean,jsonb) to service_role;
commit;
