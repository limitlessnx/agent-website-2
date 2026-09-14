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

  select decrypted_secret::jsonb into v_secret
  from public.organization_integrations i
  join public.integration_secret_bindings b on b.integration_id = i.id
  join vault.decrypted_secrets s on s.id = b.secret_id
  where i.organization_id = p_organization_id
    and i.provider = p_provider
    and i.status in ('configured','connected')
  limit 1;

  if v_secret is null then
    raise exception 'No configured credentials found for provider %', p_provider;
  end if;

  return v_secret;
end;
$$;

revoke all on function public.get_organization_integration_credentials(uuid, text) from public, anon, authenticated;
grant execute on function public.get_organization_integration_credentials(uuid, text) to service_role;

comment on function public.get_organization_integration_credentials(uuid, text)
is 'Returns decrypted organization integration credentials to service_role runtimes only.';
