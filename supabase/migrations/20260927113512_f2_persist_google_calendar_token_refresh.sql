create or replace function public.refresh_organization_integration_access_token(
  p_organization_id uuid,
  p_provider text,
  p_access_token text,
  p_expires_at timestamptz,
  p_token_type text default 'Bearer'
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_integration public.organization_integrations%rowtype;
  v_binding public.integration_secret_bindings%rowtype;
  v_credentials jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if nullif(trim(coalesce(p_access_token,'')),'') is null then
    raise exception 'Access token is required';
  end if;

  select * into v_integration
  from public.organization_integrations
  where organization_id=p_organization_id
    and provider=p_provider
    and status in ('configured','connected','degraded')
  limit 1
  for update;
  if not found then raise exception 'Integration not found'; end if;

  select * into v_binding
  from public.integration_secret_bindings
  where integration_id=v_integration.id
  for update;
  if not found then raise exception 'Integration credential binding not found'; end if;

  select s.decrypted_secret::jsonb into v_credentials
  from vault.decrypted_secrets s
  where s.id=v_binding.secret_id;
  if v_credentials is null then raise exception 'Integration credentials are unavailable'; end if;

  v_credentials := v_credentials || jsonb_build_object(
    'access_token',trim(p_access_token),
    'expires_at',p_expires_at,
    'token_type',coalesce(nullif(trim(p_token_type),''),'Bearer')
  );

  perform vault.update_secret(
    v_binding.secret_id,
    v_credentials::text,
    format('fluxknight/%s/%s',v_integration.organization_id,v_integration.provider),
    format('Fluxknight credentials for %s',v_integration.display_name),
    null
  );

  update public.integration_secret_bindings
  set last_rotated_at=now(),updated_at=now()
  where id=v_binding.id;

  update public.organization_integrations
  set
    status=case when status='configured' then 'configured' else 'connected' end,
    health=case
      when status='configured' then health
      else jsonb_build_object('state','ready','message','Google Calendar token refreshed.')
    end,
    last_checked_at=now(),
    updated_at=now()
  where id=v_integration.id;

  insert into public.audit_logs(organization_id,action,resource_type,resource_id,metadata)
  values(
    p_organization_id,'integration.access_token_refreshed','organization_integration',
    v_integration.id::text,jsonb_build_object('provider',p_provider,'expires_at',p_expires_at)
  );

  return jsonb_build_object('ok',true,'integration_id',v_integration.id,'expires_at',p_expires_at);
end
$$;

revoke all on function public.refresh_organization_integration_access_token(uuid,text,text,timestamptz,text)
from public,anon,authenticated;
grant execute on function public.refresh_organization_integration_access_token(uuid,text,text,timestamptz,text)
to service_role;
