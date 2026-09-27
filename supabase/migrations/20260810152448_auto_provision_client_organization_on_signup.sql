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
begin
  if v_company_name is null then
    return new;
  end if;

  if exists (
    select 1 from public.organization_memberships
    where user_id = new.id and status in ('active','invited')
  ) then
    return new;
  end if;

  perform public.provision_client_organization(
    new.id,
    v_company_name,
    v_company_slug,
    null,
    coalesce(v_family_name, v_company_name)
  );

  return new;
exception
  when others then
    raise warning 'Client signup provisioning failed for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_client_provisioning on auth.users;
create trigger on_auth_user_client_provisioning
after insert on auth.users
for each row
when ((new.raw_user_meta_data->>'company_name') is not null)
execute function public.handle_client_signup_provisioning();
