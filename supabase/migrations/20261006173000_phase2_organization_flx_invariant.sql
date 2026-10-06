-- Phase 2: enforce a manager Access ID for every organization created in any provisioning path.

create or replace function public.ensure_organization_manager_access_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_code text;
begin
  if nullif(trim(new.manager_access_code), '') is not null then
    new.manager_access_code := upper(trim(new.manager_access_code));
    return new;
  end if;

  loop
    v_code := 'FLX-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.organizations where manager_access_code = v_code
    );
  end loop;

  new.manager_access_code := v_code;
  return new;
end;
$$;

drop trigger if exists organizations_ensure_manager_access_code on public.organizations;
create trigger organizations_ensure_manager_access_code
before insert on public.organizations
for each row execute function public.ensure_organization_manager_access_code();

update public.organizations
set manager_access_code = upper(trim(manager_access_code))
where manager_access_code is not null;

alter table public.organizations
  alter column manager_access_code set not null;

revoke all on function public.ensure_organization_manager_access_code() from public, anon, authenticated;
grant execute on function public.ensure_organization_manager_access_code() to service_role;
