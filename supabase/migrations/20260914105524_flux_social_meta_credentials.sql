create or replace function public.get_organization_integration_credentials(
  p_organization_id uuid,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;

  select s.decrypted_secret::jsonb into v_secret
  from public.organization_integrations i
  join public.integration_secret_bindings b on b.integration_id = i.id
  join vault.decrypted_secrets s on s.id = b.secret_id
  where i.organization_id = p_organization_id
    and i.provider = p_provider
    and i.status in ('configured','connected','degraded')
  limit 1;

  if v_secret is null then
    raise exception 'No configured credentials found for provider %', p_provider;
  end if;

  return v_secret;
end;
$$;

create or replace function public.store_organization_integration_credentials(
  p_organization_id uuid,
  p_provider text,
  p_display_name text,
  p_credentials jsonb,
  p_configuration jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_integration_id uuid;
  v_secret_id uuid;
  v_existing_secret_id uuid;
  v_secret_name text;
  v_secret_keys jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_credentials is null or jsonb_typeof(p_credentials) <> 'object' then
    raise exception 'credentials object required';
  end if;

  insert into public.organization_integrations (
    organization_id, provider, display_name, status, configuration, health, last_connected_at, last_checked_at
  ) values (
    p_organization_id, p_provider, coalesce(nullif(p_display_name,''), initcap(p_provider)), 'connected',
    coalesce(p_configuration,'{}'::jsonb), jsonb_build_object('status','healthy'), now(), now()
  )
  on conflict (organization_id, provider) do update set
    display_name = excluded.display_name,
    status = 'connected',
    configuration = excluded.configuration,
    health = jsonb_build_object('status','healthy'),
    last_connected_at = now(),
    last_checked_at = now(),
    updated_at = now()
  returning id into v_integration_id;

  select secret_id into v_existing_secret_id
  from public.integration_secret_bindings
  where integration_id = v_integration_id;

  v_secret_name := format('org_%s_%s', p_organization_id, lower(p_provider));
  if v_existing_secret_id is null then
    v_secret_id := vault.create_secret(p_credentials::text, v_secret_name, 'Fluxknight organization integration credential', null);
  else
    perform vault.update_secret(v_existing_secret_id, p_credentials::text, v_secret_name, 'Fluxknight organization integration credential', null);
    v_secret_id := v_existing_secret_id;
  end if;

  select coalesce(jsonb_agg(k), '[]'::jsonb) into v_secret_keys
  from jsonb_object_keys(p_credentials) as k;

  insert into public.integration_secret_bindings (
    organization_id, integration_id, secret_id, secret_keys, last_rotated_at
  ) values (
    p_organization_id, v_integration_id, v_secret_id, v_secret_keys, now()
  )
  on conflict (integration_id) do update set
    secret_id = excluded.secret_id,
    secret_keys = excluded.secret_keys,
    last_rotated_at = now(),
    updated_at = now();

  update public.organization_integrations
  set credential_reference = v_secret_id::text, updated_at = now()
  where id = v_integration_id;

  return jsonb_build_object('integration_id', v_integration_id, 'status', 'connected');
end;
$$;

revoke all on function public.get_organization_integration_credentials(uuid, text) from public, anon, authenticated;
revoke all on function public.store_organization_integration_credentials(uuid, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.get_organization_integration_credentials(uuid, text) to service_role;
grant execute on function public.store_organization_integration_credentials(uuid, text, text, jsonb, jsonb) to service_role;

comment on function public.get_organization_integration_credentials(uuid, text)
is 'Returns decrypted organization integration credentials to service_role runtimes only.';
comment on function public.store_organization_integration_credentials(uuid, text, text, jsonb, jsonb)
is 'Creates or rotates a Vault-backed organization integration credential for service_role runtimes only.';
