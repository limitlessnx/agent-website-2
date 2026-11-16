-- Reuse the existing atomic template provisioner. A request replay never creates a tenant twice.
-- No production migration is applied by this change.
create or replace function public.create_and_provision_organization(
  p_name text, p_template_slug text, p_industry text, p_business_email text,
  p_country text, p_timezone text, p_actor_user_id uuid, p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_metadata jsonb;
  v_fingerprint text := md5(jsonb_build_array(p_name, p_template_slug, p_industry, p_business_email, p_country, p_timezone)::text);
  v_industry text;
begin
  if p_request_id is null then raise exception 'Creation request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('admin-create:' || p_request_id::text, 0));
  select metadata into v_metadata from public.organizations
    where metadata->>'creation_request_id' = p_request_id::text limit 1;
  if found then
    if v_metadata->>'creation_request_fingerprint' is distinct from v_fingerprint then
      raise exception 'Creation request parameters changed; use a new request ID';
    end if;
    return v_metadata->'creation_result';
  end if;
  select industry into v_industry from public.organization_templates where slug = p_template_slug and status = 'active';
  if not found then raise exception 'Active industry template is required'; end if;
  if nullif(trim(p_industry), '') is not null and lower(trim(p_industry)) <> lower(trim(v_industry)) then
    raise exception 'Industry must match the selected template';
  end if;
  v_result := public.create_and_provision_organization(p_name, p_template_slug, v_industry, p_business_email, p_country, p_timezone, p_actor_user_id);
  update public.organizations set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'creation_request_id', p_request_id, 'creation_request_fingerprint', v_fingerprint, 'creation_result', v_result
  ) where id = (v_result->>'organization_id')::uuid;
  return v_result;
end;
$$;
revoke all on function public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.create_and_provision_organization(text,text,text,text,text,text,uuid,uuid) to service_role;
