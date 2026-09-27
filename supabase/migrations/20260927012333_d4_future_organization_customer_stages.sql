create or replace function public.seed_customer_stages_for_new_organization()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.seed_default_customer_stages(new.id);
  return new;
end $$;

drop trigger if exists seed_customer_stages_on_organization_insert on public.organizations;
create trigger seed_customer_stages_on_organization_insert
after insert on public.organizations
for each row execute function public.seed_customer_stages_for_new_organization();
