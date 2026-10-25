begin;

create or replace function public.capture_real_estate_website_source_with_audit(
  p_organization_id uuid,
  p_actor_id text,
  p_estate_id uuid,
  p_title text,
  p_source_url text,
  p_content text,
  p_checksum text
)
returns public.knowledge_sources
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.knowledge_sources%rowtype;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id, p_actor_id);
  if p_estate_id is null or not exists (
    select 1 from public.real_estate_estates
    where organization_id = p_organization_id and id = p_estate_id
  ) then
    raise exception 'Estate was not found in this organization';
  end if;
  if nullif(btrim(p_title), '') is null or length(p_title) > 160 then
    raise exception 'Website source title must be 1 to 160 characters';
  end if;
  if p_source_url is null or length(p_source_url) > 2048 or p_source_url !~* '^https://[^[:space:]]+$' then
    raise exception 'A valid HTTPS website source URL is required';
  end if;
  if nullif(btrim(p_content), '') is null or length(p_content) > 12000 then
    raise exception 'Website snapshot text must be 1 to 12000 characters';
  end if;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 website snapshot checksum is required';
  end if;

  select source.* into v_source
  from public.knowledge_sources source
  join public.real_estate_estate_knowledge_links link
    on link.organization_id = source.organization_id
    and link.knowledge_source_id = source.id
  where source.organization_id = p_organization_id
    and link.estate_id = p_estate_id
    and source.source_type = 'website'
    and source.source_url = p_source_url
    and source.metadata->>'capture_type' = 'real_estate_website_snapshot'
  order by source.updated_at desc
  limit 1
  for update of source;

  if found then
    update public.knowledge_sources source set
      title = btrim(p_title),
      content = p_content,
      status = 'pending',
      checksum = p_checksum,
      metadata = (coalesce(source.metadata, '{}'::jsonb) - 'approved_at' - 'approved_by') || jsonb_build_object(
        'capture_type', 'real_estate_website_snapshot',
        'estate_id', p_estate_id::text,
        'snapshot_captured_at', clock_timestamp(),
        'captured_by', btrim(p_actor_id)
      ),
      updated_at = clock_timestamp()
    where source.organization_id = p_organization_id and source.id = v_source.id
    returning source.* into v_source;
  else
    insert into public.knowledge_sources(
      organization_id, collection_id, title, source_type, source_url, content, status, checksum, metadata
    ) values (
      p_organization_id, null, btrim(p_title), 'website', p_source_url, p_content, 'pending', p_checksum,
      jsonb_build_object(
        'capture_type', 'real_estate_website_snapshot',
        'estate_id', p_estate_id::text,
        'snapshot_captured_at', clock_timestamp(),
        'captured_by', btrim(p_actor_id)
      )
    ) returning * into v_source;
  end if;

  insert into public.real_estate_estate_knowledge_links(organization_id, estate_id, knowledge_source_id)
  values (p_organization_id, p_estate_id, v_source.id)
  on conflict do nothing;

  insert into public.audit_logs(organization_id, action, resource_type, resource_id, metadata)
  values (
    p_organization_id,
    'real_estate.website_source.captured',
    'real_estate_website_source',
    v_source.id::text,
    jsonb_build_object(
      'actor_id', btrim(p_actor_id),
      'source', 'real_estate_dashboard',
      'estate_id', p_estate_id,
      'source_url', p_source_url,
      'status', 'pending',
      'checksum', p_checksum,
      'changed_fields', jsonb_build_array('title', 'source_url', 'content', 'status', 'checksum')
    )
  );
  return v_source;
end;
$$;

create or replace function public.approve_real_estate_website_source_with_audit(
  p_organization_id uuid,
  p_actor_id text,
  p_estate_id uuid,
  p_knowledge_source_id uuid
)
returns public.knowledge_sources
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_source public.knowledge_sources%rowtype;
begin
  perform public.assert_real_estate_mutation_scope(p_organization_id, p_actor_id);
  select source.* into v_source
  from public.knowledge_sources source
  join public.real_estate_estate_knowledge_links link
    on link.organization_id = source.organization_id
    and link.knowledge_source_id = source.id
  where source.organization_id = p_organization_id
    and link.estate_id = p_estate_id
    and source.id = p_knowledge_source_id
  for update of source;
  if not found then
    raise exception 'Website source was not found in this estate and organization';
  end if;
  if v_source.source_type <> 'website' or coalesce(v_source.metadata->>'capture_type', '') <> 'real_estate_website_snapshot' then
    raise exception 'Only a captured estate website snapshot can be approved here';
  end if;
  if v_source.status <> 'pending' or nullif(btrim(v_source.content), '') is null or v_source.source_url is null then
    raise exception 'Only a pending website snapshot with source text can be approved';
  end if;

  update public.knowledge_sources source set
    status = 'ready',
    metadata = coalesce(source.metadata, '{}'::jsonb) || jsonb_build_object(
      'approved_at', clock_timestamp(),
      'approved_by', btrim(p_actor_id)
    ),
    updated_at = clock_timestamp()
  where source.organization_id = p_organization_id and source.id = p_knowledge_source_id
  returning source.* into v_source;

  insert into public.audit_logs(organization_id, action, resource_type, resource_id, metadata)
  values (
    p_organization_id,
    'real_estate.website_source.approved',
    'real_estate_website_source',
    v_source.id::text,
    jsonb_build_object(
      'actor_id', btrim(p_actor_id),
      'source', 'real_estate_dashboard',
      'estate_id', p_estate_id,
      'source_url', v_source.source_url,
      'status', 'ready',
      'checksum', v_source.checksum,
      'changed_fields', jsonb_build_array('status')
    )
  );
  return v_source;
end;
$$;

comment on function public.capture_real_estate_website_source_with_audit(uuid, text, uuid, text, text, text, text)
is 'Captures one estate-linked external website page as pending knowledge; Maia cannot use it before explicit approval.';
comment on function public.approve_real_estate_website_source_with_audit(uuid, text, uuid, uuid)
is 'Approves only a pending captured website snapshot linked to the exact tenant estate and records an audit event.';

revoke all on function public.capture_real_estate_website_source_with_audit(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.approve_real_estate_website_source_with_audit(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.capture_real_estate_website_source_with_audit(uuid, text, uuid, text, text, text, text) to service_role;
grant execute on function public.approve_real_estate_website_source_with_audit(uuid, text, uuid, uuid) to service_role;

commit;
