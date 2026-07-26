create or replace function public.create_and_provision_organization(
  p_name text,
  p_template_slug text,
  p_industry text default null,
  p_business_email text default null,
  p_country text default 'Nigeria',
  p_timezone text default 'Africa/Lagos',
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_name text := nullif(btrim(p_name), '');
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_organization_id uuid;
  v_provisioning jsonb;
begin
  if v_name is null then
    raise exception 'Organization name is required';
  end if;

  if nullif(btrim(p_template_slug), '') is null then
    raise exception 'Organization template is required';
  end if;

  if not exists (
    select 1 from public.organization_templates
    where slug = p_template_slug and status = 'active'
  ) then
    raise exception 'Active organization template not found: %', p_template_slug;
  end if;

  v_base_slug := public.slugify_identifier(v_name);
  if v_base_slug is null or v_base_slug = '' then
    raise exception 'Unable to generate an organization slug';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.organizations (name, slug, status, metadata)
  values (
    v_name,
    v_slug,
    'active',
    jsonb_strip_nulls(jsonb_build_object(
      'industry', nullif(btrim(p_industry), ''),
      'business_email', nullif(btrim(p_business_email), ''),
      'country', nullif(btrim(p_country), ''),
      'timezone', nullif(btrim(p_timezone), ''),
      'created_via', 'admin_organization_wizard',
      'template_slug', p_template_slug
    ))
  )
  returning id into v_organization_id;

  v_provisioning := public.provision_organization_template(
    v_organization_id,
    p_template_slug,
    p_actor_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'organization_id', v_organization_id,
    'organization_name', v_name,
    'organization_slug', v_slug,
    'template_slug', p_template_slug,
    'provisioning', v_provisioning
  );
end;
$$;

revoke all on function public.create_and_provision_organization(text, text, text, text, text, text, uuid)
from public, anon, authenticated;

grant execute on function public.create_and_provision_organization(text, text, text, text, text, text, uuid)
to service_role;

comment on function public.create_and_provision_organization(text, text, text, text, text, text, uuid)
is 'Atomically creates a Fluxknight organization and provisions its selected platform template.';