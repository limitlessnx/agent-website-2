-- Keep the manager access-code generator compatible with the extensions schema.
create or replace function public.ensure_organization_manager_access_code()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_code text;
begin
  if nullif(trim(new.manager_access_code), '') is not null then
    new.manager_access_code := upper(trim(new.manager_access_code));
    return new;
  end if;

  loop
    v_code := 'FLX-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.organizations where manager_access_code = v_code
    );
  end loop;

  new.manager_access_code := v_code;
  return new;
end;
$function$;

revoke all on function public.ensure_organization_manager_access_code() from public, anon, authenticated;
grant execute on function public.ensure_organization_manager_access_code() to service_role;
