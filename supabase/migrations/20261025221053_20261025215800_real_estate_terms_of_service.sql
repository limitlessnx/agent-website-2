begin;

alter table public.real_estate_estates
  add column if not exists terms_of_service text;

comment on column public.real_estate_estates.terms_of_service is
  'Estate-specific terms of service for approved client guidance; not legal advice or transaction authorization.';

create or replace function public.save_real_estate_estate_with_audit(
  p_organization_id uuid,
  p_actor_id text,
  p_estate_id uuid,
  p_payload jsonb
)
returns public.real_estate_estates
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.real_estate_estates%rowtype;
  v_changed jsonb;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id, p_actor_id);

  if jsonb_typeof(p_payload) <> 'object'
     or length(btrim(coalesce(p_payload->>'name', ''))) < 1 then
    raise exception 'Estate name is required';
  end if;
  if coalesce(p_payload->>'status', 'draft') not in ('draft', 'published', 'archived') then
    raise exception 'Invalid estate status';
  end if;
  if coalesce(p_payload->>'knowledge_status', 'draft') not in ('draft', 'approved') then
    raise exception 'Invalid estate knowledge status';
  end if;

  if p_estate_id is null then
    insert into public.real_estate_estates (
      organization_id, name, description, location, address, contact_name,
      contact_email, contact_phone, status, cover_image_url, payment_terms,
      operating_instructions, terms_of_service, knowledge_status, provenance
    ) values (
      p_organization_id, btrim(p_payload->>'name'), p_payload->>'description',
      p_payload->>'location', p_payload->>'address', p_payload->>'contact_name',
      p_payload->>'contact_email', p_payload->>'contact_phone',
      coalesce(p_payload->>'status', 'draft'), p_payload->>'cover_image_url',
      coalesce(p_payload->'payment_terms', '{}'::jsonb),
      p_payload->>'operating_instructions', nullif(btrim(p_payload->>'terms_of_service'), ''),
      coalesce(p_payload->>'knowledge_status', 'draft'),
      coalesce(p_payload->'provenance', '{}'::jsonb)
    ) returning * into v_row;
  else
    update public.real_estate_estates e set
      name = btrim(p_payload->>'name'),
      description = case when p_payload ? 'description' then p_payload->>'description' else e.description end,
      location = case when p_payload ? 'location' then p_payload->>'location' else e.location end,
      address = case when p_payload ? 'address' then p_payload->>'address' else e.address end,
      contact_name = case when p_payload ? 'contact_name' then p_payload->>'contact_name' else e.contact_name end,
      contact_email = case when p_payload ? 'contact_email' then p_payload->>'contact_email' else e.contact_email end,
      contact_phone = case when p_payload ? 'contact_phone' then p_payload->>'contact_phone' else e.contact_phone end,
      status = case when p_payload ? 'status' then p_payload->>'status' else e.status end,
      cover_image_url = case when p_payload ? 'cover_image_url' then p_payload->>'cover_image_url' else e.cover_image_url end,
      payment_terms = case when p_payload ? 'payment_terms' then coalesce(p_payload->'payment_terms', '{}'::jsonb) else e.payment_terms end,
      operating_instructions = case when p_payload ? 'operating_instructions' then p_payload->>'operating_instructions' else e.operating_instructions end,
      terms_of_service = case when p_payload ? 'terms_of_service' then nullif(btrim(p_payload->>'terms_of_service'), '') else e.terms_of_service end,
      knowledge_status = case when p_payload ? 'knowledge_status' then p_payload->>'knowledge_status' else e.knowledge_status end,
      provenance = case when p_payload ? 'provenance' then coalesce(p_payload->'provenance', '{}'::jsonb) else e.provenance end
    where e.organization_id = p_organization_id
      and e.id = p_estate_id
    returning e.* into v_row;

    if not found then
      raise exception 'Estate was not found in this organization';
    end if;
  end if;

  select coalesce(jsonb_agg(key), '[]'::jsonb)
    into v_changed
    from jsonb_object_keys(p_payload) as keys(key);

  insert into public.audit_logs (organization_id, action, resource_type, resource_id, metadata)
  values (
    p_organization_id,
    'real_estate.estate.saved',
    'real_estate',
    v_row.id::text,
    jsonb_build_object(
      'actor_id', btrim(p_actor_id),
      'source', 'real_estate_dashboard',
      'changed_fields', v_changed
    )
  );

  return v_row;
end;
$$;

revoke all on function public.save_real_estate_estate_with_audit(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_real_estate_estate_with_audit(uuid, text, uuid, jsonb)
  to service_role;

commit;
