create or replace function public.provision_client_workspace(
  p_user_id uuid,
  p_organization_name text,
  p_organization_slug text default null,
  p_industry_slug text default null,
  p_business_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_provisioned jsonb;
  v_org_id uuid;
  v_membership_id uuid;
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

  update public.organizations
  set metadata = coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'industry_slug', trim(p_industry_slug),
      'workspace_mode', 'free',
      'onboarding_stage', 'workspace_created'
    ),
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
  on conflict (organization_id) do update
    set industry = excluded.industry,
        business_name = excluded.business_name,
        business_email = excluded.business_email,
        updated_at = now();

  return v_provisioned || jsonb_build_object(
    'industry_slug', trim(p_industry_slug),
    'workspace_mode', 'free',
    'trial_started', false
  );
end;
$function$;
