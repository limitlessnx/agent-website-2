create or replace function public.sync_system_routes_after_installation_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_organization_id uuid:=coalesce(new.organization_id,old.organization_id);
begin
  if exists(select 1 from public.organizations where id=v_organization_id) then
    perform public.sync_organization_system_event_routes(v_organization_id);
  end if;
  return coalesce(new,old);
end
$$;

revoke all on function public.sync_system_routes_after_installation_change() from public,anon,authenticated;
grant execute on function public.sync_system_routes_after_installation_change() to service_role;
