create or replace function public.seed_organization_role_presets_after_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ensure_organization_role_presets(new.organization_id);
  return new;
end;
$$;

revoke all on function public.seed_organization_role_presets_after_membership() from public, anon, authenticated;
grant execute on function public.seed_organization_role_presets_after_membership() to service_role;

drop trigger if exists organization_membership_seed_role_presets on public.organization_memberships;
create trigger organization_membership_seed_role_presets
after insert on public.organization_memberships
for each row execute function public.seed_organization_role_presets_after_membership();

comment on function public.seed_organization_role_presets_after_membership()
is 'Ensures every newly onboarded tenant receives Owner, Manager, Supervisor, and Team Member role presets when its first membership is created.';
