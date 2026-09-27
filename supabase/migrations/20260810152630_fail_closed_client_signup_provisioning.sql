create or replace function public.handle_client_signup_provisioning()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_company_name text := nullif(btrim(new.raw_user_meta_data->>'company_name'), '');
  v_company_slug text := nullif(btrim(new.raw_user_meta_data->>'company_slug'), '');
  v_family_name text := nullif(btrim(new.raw_user_meta_data->>'agent_family_name'), '');
  v_email text := coalesce(nullif(btrim(new.email), ''), nullif(btrim(new.raw_user_meta_data->>'email'), ''));
  v_existing_membership public.organization_memberships%rowtype;
  v_provisioned jsonb;
  v_org_id uuid;
  v_membership_id uuid;
begin
  if v_company_name is null then
    return new;
  end if;

  select * into v_existing_membership
  from public.organization_memberships
  where user_id = new.id and status in ('active','invited')
  order by created_at asc
  limit 1;

  if v_existing_membership.id is null then
    v_provisioned := public.provision_client_organization(
      new.id,
      v_company_name,
      v_company_slug,
      null,
      coalesce(v_family_name, v_company_name)
    );
    v_org_id := (v_provisioned->>'organization_id')::uuid;
    v_membership_id := (v_provisioned->>'membership_id')::uuid;
  else
    v_org_id := v_existing_membership.organization_id;
    v_membership_id := v_existing_membership.id;
  end if;

  insert into public.client_onboarding_profiles (
    organization_id,
    membership_id,
    user_id,
    status,
    current_step,
    business_name,
    business_email
  )
  select
    v_org_id,
    v_membership_id,
    new.id,
    'in_progress',
    1,
    v_company_name,
    v_email
  where not exists (
    select 1 from public.client_onboarding_profiles
    where user_id = new.id or organization_id = v_org_id
  );

  return new;
end;
$$;
