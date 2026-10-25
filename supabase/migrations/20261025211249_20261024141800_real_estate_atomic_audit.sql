begin;

create or replace function public.assert_real_estate_mutation_scope(p_organization_id uuid,p_actor_id text)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_org public.organizations%rowtype;
begin
  if nullif(btrim(p_actor_id),'') is null then raise exception 'Authenticated audit actor is required'; end if;
  -- Hold the classification/status stable until the guarded audit mutation commits.
  select * into v_org from public.organizations where id=p_organization_id for share;
  if not found or v_org.status<>'active' or not (v_org.slug='limitless-realty' or regexp_replace(lower(coalesce(v_org.metadata->>'industry_slug',v_org.metadata->>'industry','')),'[^a-z]','','g')='realestate') then
    raise exception 'An active real-estate organization is required';
  end if;
end;
$$;

create or replace function public.save_real_estate_estate_with_audit(p_organization_id uuid,p_actor_id text,p_estate_id uuid,p_payload jsonb)
returns public.real_estate_estates language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.real_estate_estates%rowtype; v_changed jsonb;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if jsonb_typeof(p_payload)<>'object' or length(btrim(coalesce(p_payload->>'name','')))<1 then raise exception 'Estate name is required'; end if;
  if coalesce(p_payload->>'status','draft') not in ('draft','published','archived') then raise exception 'Invalid estate status'; end if;
  if coalesce(p_payload->>'knowledge_status','draft') not in ('draft','approved') then raise exception 'Invalid estate knowledge status'; end if;
  if p_estate_id is null then
    insert into public.real_estate_estates(organization_id,name,description,location,address,contact_name,contact_email,contact_phone,status,cover_image_url,payment_terms,operating_instructions,knowledge_status,provenance)
    values(p_organization_id,btrim(p_payload->>'name'),p_payload->>'description',p_payload->>'location',p_payload->>'address',p_payload->>'contact_name',p_payload->>'contact_email',p_payload->>'contact_phone',coalesce(p_payload->>'status','draft'),p_payload->>'cover_image_url',coalesce(p_payload->'payment_terms','{}'::jsonb),p_payload->>'operating_instructions',coalesce(p_payload->>'knowledge_status','draft'),coalesce(p_payload->'provenance','{}'::jsonb)) returning * into v_row;
  else
    update public.real_estate_estates e set
      name=btrim(p_payload->>'name'),
      description=case when p_payload?'description' then p_payload->>'description' else e.description end,
      location=case when p_payload?'location' then p_payload->>'location' else e.location end,
      address=case when p_payload?'address' then p_payload->>'address' else e.address end,
      contact_name=case when p_payload?'contact_name' then p_payload->>'contact_name' else e.contact_name end,
      contact_email=case when p_payload?'contact_email' then p_payload->>'contact_email' else e.contact_email end,
      contact_phone=case when p_payload?'contact_phone' then p_payload->>'contact_phone' else e.contact_phone end,
      status=case when p_payload?'status' then p_payload->>'status' else e.status end,
      cover_image_url=case when p_payload?'cover_image_url' then p_payload->>'cover_image_url' else e.cover_image_url end,
      payment_terms=case when p_payload?'payment_terms' then coalesce(p_payload->'payment_terms','{}'::jsonb) else e.payment_terms end,
      operating_instructions=case when p_payload?'operating_instructions' then p_payload->>'operating_instructions' else e.operating_instructions end,
      knowledge_status=case when p_payload?'knowledge_status' then p_payload->>'knowledge_status' else e.knowledge_status end,
      provenance=case when p_payload?'provenance' then coalesce(p_payload->'provenance','{}'::jsonb) else e.provenance end
    where e.organization_id=p_organization_id and e.id=p_estate_id returning e.* into v_row;
    if not found then raise exception 'Estate was not found in this organization'; end if;
  end if;
  select coalesce(jsonb_agg(key),'[]'::jsonb) into v_changed from jsonb_object_keys(p_payload) as keys(key);
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,'real_estate.estate.saved','real_estate',v_row.id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','changed_fields',v_changed));
  return v_row;
end;
$$;

create or replace function public.save_real_estate_estate_faq_with_audit(p_organization_id uuid,p_actor_id text,p_estate_id uuid,p_faq_id uuid,p_payload jsonb)
returns public.real_estate_estate_faqs language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.real_estate_estate_faqs%rowtype; v_action text;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if not exists(select 1 from public.real_estate_estates where organization_id=p_organization_id and id=p_estate_id) then raise exception 'Estate was not found in this organization'; end if;
  if length(btrim(coalesce(p_payload->>'question','')))<1 or length(btrim(coalesce(p_payload->>'answer','')))<1 then raise exception 'FAQ question and answer are required'; end if;
  if p_faq_id is null then
    insert into public.real_estate_estate_faqs(organization_id,estate_id,question,answer,category,sort_order,provenance)
    values(p_organization_id,p_estate_id,btrim(p_payload->>'question'),btrim(p_payload->>'answer'),nullif(btrim(p_payload->>'category'),''),coalesce((p_payload->>'sort_order')::integer,0),coalesce(p_payload->'provenance','{}'::jsonb)) returning * into v_row;
    v_action:='real_estate.faq.saved';
  else
    update public.real_estate_estate_faqs f set question=btrim(p_payload->>'question'),answer=btrim(p_payload->>'answer'),
      category=case when p_payload?'category' then nullif(btrim(p_payload->>'category'),'') else f.category end,
      sort_order=case when p_payload?'sort_order' then (p_payload->>'sort_order')::integer else f.sort_order end,
      provenance=case when p_payload?'provenance' then coalesce(p_payload->'provenance','{}'::jsonb) else f.provenance end
    where f.organization_id=p_organization_id and f.estate_id=p_estate_id and f.id=p_faq_id returning f.* into v_row;
    if not found then raise exception 'FAQ was not found in this estate and organization'; end if;
    v_action:='real_estate.faq.saved';
  end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,v_action,'real_estate',v_row.id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','estate_id',p_estate_id));
  return v_row;
end;
$$;

create or replace function public.delete_real_estate_estate_faq_with_audit(p_organization_id uuid,p_actor_id text,p_estate_id uuid,p_faq_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  delete from public.real_estate_estate_faqs where organization_id=p_organization_id and estate_id=p_estate_id and id=p_faq_id returning id into v_id;
  if not found then raise exception 'FAQ was not found in this estate and organization'; end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,'real_estate.faq.deleted','real_estate',v_id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','estate_id',p_estate_id));
  return true;
end;
$$;

create or replace function public.assign_real_estate_property_with_audit(p_organization_id uuid,p_actor_id text,p_property_id uuid,p_estate_id uuid)
returns public.properties language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.properties%rowtype;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if p_estate_id is not null and not exists(select 1 from public.real_estate_estates where organization_id=p_organization_id and id=p_estate_id) then raise exception 'Estate was not found in this organization'; end if;
  update public.properties p set estate_id=p_estate_id where p.organization_id=p_organization_id and p.id=p_property_id returning p.* into v_row;
  if not found then raise exception 'Property was not found in this organization'; end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,'real_estate.property.estate_assigned','real_estate',p_property_id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','estate_id',p_estate_id));
  return v_row;
end;
$$;

create or replace function public.link_real_estate_knowledge_source_with_audit(p_organization_id uuid,p_actor_id text,p_estate_id uuid,p_knowledge_source_id uuid,p_remove boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_rows integer; v_action text;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if not exists(select 1 from public.real_estate_estates where organization_id=p_organization_id and id=p_estate_id) then raise exception 'Estate was not found in this organization'; end if;
  if not exists(select 1 from public.knowledge_sources where organization_id=p_organization_id and id=p_knowledge_source_id) then raise exception 'Knowledge source was not found in this organization'; end if;
  if p_remove then
    delete from public.real_estate_estate_knowledge_links where organization_id=p_organization_id and estate_id=p_estate_id and knowledge_source_id=p_knowledge_source_id;
    get diagnostics v_rows=row_count; v_action:='real_estate.knowledge.unlinked';
  else
    insert into public.real_estate_estate_knowledge_links(organization_id,estate_id,knowledge_source_id)
      values(p_organization_id,p_estate_id,p_knowledge_source_id) on conflict do nothing;
    get diagnostics v_rows=row_count; v_action:='real_estate.knowledge.linked';
  end if;
  if v_rows>0 then
    insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
      values(p_organization_id,v_action,'real_estate',p_estate_id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','knowledge_source_id',p_knowledge_source_id));
  end if;
  return not p_remove;
end;
$$;

create or replace function public.reorder_real_estate_estate_faqs_with_audit(p_organization_id uuid,p_actor_id text,p_estate_id uuid,p_faq_ids uuid[])
returns setof public.real_estate_estate_faqs language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_total integer; v_distinct integer;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if not exists(select 1 from public.real_estate_estates where organization_id=p_organization_id and id=p_estate_id) then raise exception 'Estate was not found in this organization'; end if;
  select count(*)::integer into v_total from public.real_estate_estate_faqs where organization_id=p_organization_id and estate_id=p_estate_id;
  select count(distinct item)::integer into v_distinct from unnest(coalesce(p_faq_ids,'{}'::uuid[])) item;
  if cardinality(coalesce(p_faq_ids,'{}'::uuid[]))<>v_total or v_distinct<>v_total or exists(
    select 1 from unnest(coalesce(p_faq_ids,'{}'::uuid[])) requested(id)
    where not exists(select 1 from public.real_estate_estate_faqs f where f.organization_id=p_organization_id and f.estate_id=p_estate_id and f.id=requested.id)
  ) then raise exception 'FAQ reorder must include exactly the FAQs in this estate'; end if;
  return query with ranked as(select id,(ordinality-1)::integer as sort_order from unnest(coalesce(p_faq_ids,'{}'::uuid[])) with ordinality as input(id,ordinality))
    update public.real_estate_estate_faqs f set sort_order=ranked.sort_order
    from ranked where f.organization_id=p_organization_id and f.estate_id=p_estate_id and f.id=ranked.id returning f.*;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
    values(p_organization_id,'real_estate.faq.reordered','real_estate',p_estate_id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source','real_estate_dashboard','ordered_faq_ids',to_jsonb(coalesce(p_faq_ids,'{}'::uuid[]))));
  return;
end;
$$;

create or replace function public.create_real_estate_inspection_request_with_audit(
  p_organization_id uuid,p_actor_id text,p_legacy_lead_id uuid,p_crm_lead_id uuid,p_customer_id uuid,p_property_id uuid,
  p_property_query_text text,p_property_verification_status text,p_requested_start_at timestamptz,p_requested_end_at timestamptz,
  p_timezone text,p_status text,p_source text,p_idempotency_key text,p_notes text,p_metadata jsonb
) returns public.real_estate_inspections language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_row public.real_estate_inspections%rowtype;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,p_actor_id);
  if p_customer_id is null or not exists(select 1 from public.crm_customers where organization_id=p_organization_id and id=p_customer_id and status not in ('blocked','archived')) then raise exception 'A tenant-scoped active customer is required'; end if;
  if p_property_verification_status not in ('unresolved','verified') or p_status not in ('requested','requested_verification') then raise exception 'Invalid inspection request state'; end if;
  if p_property_verification_status='verified' and (p_property_id is null or not exists(select 1 from public.properties where organization_id=p_organization_id and id=p_property_id and status='active')) then raise exception 'A verified inspection property must be active in the organization'; end if;
  if p_idempotency_key is not null then
    select * into v_row from public.real_estate_inspections where organization_id=p_organization_id and booking_idempotency_key=p_idempotency_key for update;
    if found then return v_row; end if;
  end if;
  insert into public.real_estate_inspections(organization_id,legacy_lead_id,crm_lead_id,customer_id,property_id,property_query_text,property_verification_status,requested_start_at,requested_end_at,timezone,status,source,booking_idempotency_key,notes,metadata)
  values(p_organization_id,p_legacy_lead_id,p_crm_lead_id,p_customer_id,p_property_id,nullif(btrim(p_property_query_text),''),p_property_verification_status,p_requested_start_at,p_requested_end_at,coalesce(nullif(btrim(p_timezone),''),'Africa/Lagos'),p_status,coalesce(nullif(btrim(p_source),''),'real_estate'),p_idempotency_key,nullif(btrim(p_notes),''),coalesce(p_metadata,'{}'::jsonb)) returning * into v_row;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,'real_estate.inspection.requested','real_estate_inspection',v_row.id::text,jsonb_build_object('actor_id',btrim(p_actor_id),'source',coalesce(nullif(btrim(p_source),''),'real_estate'),'status',v_row.status,'property_verification_status',v_row.property_verification_status));
  return v_row;
end;
$$;

create or replace function public.transition_real_estate_inspection_with_audit(
  p_organization_id uuid,p_inspection_id uuid,p_status text,p_property_id uuid,p_requested_start_at timestamptz,p_requested_end_at timestamptz,
  p_booking_request_event_id uuid,p_canonical_appointment_id uuid,p_appointment_external_event_id text,p_approved_by text,
  p_unavailable_reason text,p_notes text,p_actor_id text,p_timezone text default null
) returns public.real_estate_inspections language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_before public.real_estate_inspections%rowtype; v_row public.real_estate_inspections%rowtype; v_actor text:=nullif(btrim(p_actor_id),'');
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,v_actor);
  select * into v_before from public.real_estate_inspections where organization_id=p_organization_id and id=p_inspection_id for update;
  if not found then raise exception 'Inspection was not found in organization'; end if;
  v_row:=public.transition_real_estate_inspection(p_organization_id,p_inspection_id,p_status,p_property_id,p_requested_start_at,p_requested_end_at,p_booking_request_event_id,p_canonical_appointment_id,p_appointment_external_event_id,p_approved_by,p_unavailable_reason,p_notes);
  if nullif(btrim(coalesce(p_timezone,'')),'') is not null then
    update public.real_estate_inspections set timezone=btrim(p_timezone),updated_at=clock_timestamp() where organization_id=p_organization_id and id=p_inspection_id returning * into v_row;
  end if;
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,'real_estate.inspection.transitioned','real_estate_inspection',v_row.id::text,
    jsonb_build_object('actor_id',v_actor,'source',case when v_actor like 'system:%' then 'system' else 'real_estate_dashboard' end,'from_status',v_before.status,'to_status',v_row.status,'appointment_id',v_row.canonical_appointment_id));
  return v_row;
end;
$$;

create or replace function public.cancel_real_estate_inspection_with_audit(p_organization_id uuid,p_inspection_id uuid,p_reason text,p_actor_id text)
returns public.real_estate_inspections language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_before public.real_estate_inspections%rowtype; v_row public.real_estate_inspections%rowtype; v_actor text:=nullif(btrim(p_actor_id),'');
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id,v_actor);
  select * into v_before from public.real_estate_inspections where organization_id=p_organization_id and id=p_inspection_id for update;
  if not found then raise exception 'Inspection was not found in organization'; end if;
  v_row:=public.cancel_real_estate_inspection(p_organization_id,p_inspection_id,p_reason);
  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,'real_estate.inspection.cancelled','real_estate_inspection',v_row.id::text,jsonb_build_object('actor_id',v_actor,'source',case when v_actor like 'system:%' then 'system' else 'real_estate_dashboard' end,'from_status',v_before.status,'to_status',v_row.status));
  return v_row;
end;
$$;

revoke all on function public.assert_real_estate_mutation_scope(uuid,text) from public,anon,authenticated;
revoke all on function public.save_real_estate_estate_with_audit(uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.save_real_estate_estate_faq_with_audit(uuid,text,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.delete_real_estate_estate_faq_with_audit(uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.assign_real_estate_property_with_audit(uuid,text,uuid,uuid) from public,anon,authenticated;
revoke all on function public.link_real_estate_knowledge_source_with_audit(uuid,text,uuid,uuid,boolean) from public,anon,authenticated;
revoke all on function public.reorder_real_estate_estate_faqs_with_audit(uuid,text,uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.create_real_estate_inspection_request_with_audit(uuid,text,uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.transition_real_estate_inspection_with_audit(uuid,uuid,text,uuid,timestamptz,timestamptz,uuid,uuid,text,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.cancel_real_estate_inspection_with_audit(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.save_real_estate_estate_with_audit(uuid,text,uuid,jsonb) to service_role;
grant execute on function public.save_real_estate_estate_faq_with_audit(uuid,text,uuid,uuid,jsonb) to service_role;
grant execute on function public.delete_real_estate_estate_faq_with_audit(uuid,text,uuid,uuid) to service_role;
grant execute on function public.assign_real_estate_property_with_audit(uuid,text,uuid,uuid) to service_role;
grant execute on function public.link_real_estate_knowledge_source_with_audit(uuid,text,uuid,uuid,boolean) to service_role;
grant execute on function public.reorder_real_estate_estate_faqs_with_audit(uuid,text,uuid,uuid[]) to service_role;
grant execute on function public.create_real_estate_inspection_request_with_audit(uuid,text,uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,text,text,text,text,text,jsonb) to service_role;
grant execute on function public.transition_real_estate_inspection_with_audit(uuid,uuid,text,uuid,timestamptz,timestamptz,uuid,uuid,text,text,text,text,text,text) to service_role;
grant execute on function public.cancel_real_estate_inspection_with_audit(uuid,uuid,text,text) to service_role;
commit;
