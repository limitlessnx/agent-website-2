CREATE OR REPLACE FUNCTION public.provision_client_workspace(p_user_id uuid, p_organization_name text, p_organization_slug text DEFAULT NULL::text, p_industry_slug text DEFAULT NULL::text, p_business_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_provisioned jsonb;
  v_org_id uuid;
  v_membership_id uuid;
  v_metadata jsonb;
  v_industry text;
begin
  if nullif(trim(p_industry_slug), '') is null then
    raise exception 'industry_slug is required';
  end if;

  v_provisioned := public.provision_client_organization(
    p_user_id,
    p_organization_name,
    p_organization_slug,
    null,
    null
  );

  v_org_id := (v_provisioned ->> 'organization_id')::uuid;
  v_membership_id := (v_provisioned ->> 'membership_id')::uuid;

  select metadata into v_metadata from public.organizations where id = v_org_id for update;
  select industry into v_industry from public.client_onboarding_profiles where organization_id = v_org_id;
  if coalesce(v_industry, v_metadata->>'industry_slug', trim(p_industry_slug)) <> trim(p_industry_slug) then
    raise exception 'Workspace industry already exists and cannot be changed by provisioning';
  end if;
  update public.organizations
  set metadata = jsonb_build_object(
      'industry_slug', trim(p_industry_slug),
      'workspace_mode', 'free',
      'onboarding_stage', 'workspace_created'
    ) || coalesce(metadata, '{}'::jsonb),
    updated_at = now()
  where id = v_org_id;

  insert into public.flux_credit_wallets (
    organization_id,
    plan_code,
    monthly_allowance,
    balance,
    status,
    metadata
  )
  values (
    v_org_id,
    'basic',
    0,
    0,
    'paused',
    jsonb_build_object('workspace_mode', 'free', 'trial_available', true)
  )
  on conflict (organization_id) do nothing;

  insert into public.client_onboarding_profiles (
    organization_id,
    membership_id,
    user_id,
    status,
    current_step,
    business_name,
    industry,
    business_email,
    channels,
    whatsapp_preferences
  )
  values (
    v_org_id,
    v_membership_id,
    p_user_id,
    'in_progress',
    1,
    trim(p_organization_name),
    trim(p_industry_slug),
    nullif(trim(p_business_email), ''),
    jsonb_build_array('WhatsApp'),
    jsonb_build_object('connection_path', 'need_help')
  )
  on conflict (organization_id) do nothing;

  return v_provisioned || jsonb_build_object(
    'industry_slug', trim(p_industry_slug),
    'workspace_mode', coalesce(v_metadata->>'workspace_mode', 'free'),
    'trial_started', coalesce((v_metadata->>'trial_started') = 'true', false)
  );
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.provision_client_workspace(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_client_workspace(uuid,text,text,text,text) TO service_role;
