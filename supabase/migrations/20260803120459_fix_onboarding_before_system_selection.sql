do $$
begin
  if to_regprocedure('public.complete_client_onboarding_legacy(uuid,uuid)') is null
     and to_regprocedure('public.complete_client_onboarding(uuid,uuid)') is not null then
    alter function public.complete_client_onboarding(uuid, uuid)
      rename to complete_client_onboarding_legacy;
  end if;
end $$;

create or replace function public.complete_client_onboarding(
  p_organization_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.client_onboarding_profiles%rowtype;
begin
  select * into v_profile
  from public.client_onboarding_profiles
  where organization_id = p_organization_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Onboarding profile not found'; end if;
  if coalesce(jsonb_array_length(v_profile.business_goals), 0) = 0 then
    raise exception 'Select at least one business goal';
  end if;

  if coalesce(jsonb_array_length(v_profile.requested_agents), 0) = 0 then
    update public.client_onboarding_profiles
    set status = 'submitted', current_step = 4,
        completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = v_profile.id;

    return jsonb_build_object(
      'onboarding_id', v_profile.id,
      'status', 'submitted',
      'next', '/portal/marketplace',
      'agent_family_id', null,
      'project_id', null,
      'agent_id', null
    );
  end if;

  return public.complete_client_onboarding_legacy(p_organization_id, p_user_id);
end;
$$;
