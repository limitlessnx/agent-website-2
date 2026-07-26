create table if not exists public.integration_secret_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null unique references public.organization_integrations(id) on delete cascade,
  secret_id uuid not null unique,
  secret_keys jsonb not null default '[]'::jsonb,
  created_by_email text,
  last_rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integration_secret_bindings_organization_idx
  on public.integration_secret_bindings(organization_id);

alter table public.integration_secret_bindings enable row level security;
revoke all on public.integration_secret_bindings from public, anon, authenticated;
grant select, insert, update, delete on public.integration_secret_bindings to service_role;

create or replace function public.upsert_integration_credentials(
  p_integration_id uuid,
  p_credentials jsonb,
  p_configuration jsonb default '{}'::jsonb,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_integration public.organization_integrations%rowtype;
  v_binding public.integration_secret_bindings%rowtype;
  v_secret_id uuid;
  v_secret_name text;
  v_keys jsonb;
begin
  if p_credentials is null or jsonb_typeof(p_credentials) <> 'object' or p_credentials = '{}'::jsonb then
    raise exception 'At least one credential is required';
  end if;

  select * into v_integration
  from public.organization_integrations
  where id = p_integration_id
  for update;

  if not found then raise exception 'Integration not found'; end if;

  select coalesce(jsonb_agg(key order by key), '[]'::jsonb) into v_keys
  from jsonb_object_keys(p_credentials) as key;

  select * into v_binding
  from public.integration_secret_bindings
  where integration_id = p_integration_id
  for update;

  v_secret_name := format('fluxknight/%s/%s', v_integration.organization_id, v_integration.provider);

  if found then
    perform vault.update_secret(v_binding.secret_id, p_credentials::text, v_secret_name,
      format('Fluxknight credentials for %s', v_integration.display_name), null);
    v_secret_id := v_binding.secret_id;

    update public.integration_secret_bindings
    set secret_keys = v_keys,
        created_by_email = coalesce(p_actor_email, created_by_email),
        last_rotated_at = now(),
        updated_at = now()
    where id = v_binding.id;
  else
    v_secret_id := vault.create_secret(p_credentials::text, v_secret_name,
      format('Fluxknight credentials for %s', v_integration.display_name), null);

    insert into public.integration_secret_bindings(
      organization_id, integration_id, secret_id, secret_keys, created_by_email
    ) values (
      v_integration.organization_id, p_integration_id, v_secret_id, v_keys, p_actor_email
    );
  end if;

  update public.organization_integrations
  set credential_reference = 'vault:' || v_secret_id::text,
      configuration = coalesce(configuration, '{}'::jsonb) || coalesce(p_configuration, '{}'::jsonb),
      status = 'configured',
      health = jsonb_build_object('state', 'configured', 'message', 'Credentials saved securely; connection test pending.'),
      updated_at = now()
  where id = p_integration_id;

  insert into public.audit_logs(organization_id, action, resource_type, resource_id, metadata)
  values (
    v_integration.organization_id,
    'integration.credentials_updated',
    'organization_integration',
    p_integration_id::text,
    jsonb_build_object('provider', v_integration.provider, 'credential_keys', v_keys, 'actor_email', p_actor_email)
  );

  return jsonb_build_object('ok', true, 'integration_id', p_integration_id, 'status', 'configured',
    'credential_keys', v_keys, 'last_rotated_at', now());
end;
$$;

create or replace function public.disconnect_organization_integration(
  p_integration_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_integration public.organization_integrations%rowtype;
  v_secret_id uuid;
begin
  select * into v_integration
  from public.organization_integrations
  where id = p_integration_id
  for update;
  if not found then raise exception 'Integration not found'; end if;

  select secret_id into v_secret_id
  from public.integration_secret_bindings
  where integration_id = p_integration_id;

  delete from public.integration_secret_bindings where integration_id = p_integration_id;
  if v_secret_id is not null then delete from vault.secrets where id = v_secret_id; end if;

  update public.organization_integrations
  set credential_reference = null,
      status = 'disconnected',
      health = jsonb_build_object('state', 'disconnected', 'message', 'Credentials removed.'),
      last_checked_at = null,
      last_connected_at = null,
      updated_at = now()
  where id = p_integration_id;

  insert into public.audit_logs(organization_id, action, resource_type, resource_id, metadata)
  values (v_integration.organization_id, 'integration.disconnected', 'organization_integration',
    p_integration_id::text, jsonb_build_object('provider', v_integration.provider, 'actor_email', p_actor_email));

  return jsonb_build_object('ok', true, 'integration_id', p_integration_id, 'status', 'disconnected');
end;
$$;

create or replace view public.organization_integration_admin_view as
select i.id, i.organization_id, o.name as organization_name, i.provider, i.display_name,
  i.status, i.configuration, i.health, i.last_checked_at, i.last_connected_at, i.updated_at,
  b.secret_keys, b.last_rotated_at, (b.id is not null) as has_credentials
from public.organization_integrations i
join public.organizations o on o.id = i.organization_id
left join public.integration_secret_bindings b on b.integration_id = i.id;

revoke all on public.organization_integration_admin_view from public, anon, authenticated;
grant select on public.organization_integration_admin_view to service_role;
revoke all on function public.upsert_integration_credentials(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.upsert_integration_credentials(uuid, jsonb, jsonb, text) to service_role;
revoke all on function public.disconnect_organization_integration(uuid, text) from public, anon, authenticated;
grant execute on function public.disconnect_organization_integration(uuid, text) to service_role;