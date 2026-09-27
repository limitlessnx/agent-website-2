create or replace function private.apply_agent_catalog_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering public.agent_catalog_offerings%rowtype;
  marketplace public.system_catalog%rowtype;
  v_system_slug text;
begin
  if coalesce(new.configuration ->> 'catalog_source','') = 'system_catalog' then
    v_system_slug := coalesce(new.configuration ->> 'system_slug', replace(new.agent_key,'_','-'));

    select * into marketplace
    from public.system_catalog
    where slug = v_system_slug
      and category = 'core'
      and status = 'available';

    if marketplace.id is null then
      raise exception 'Unknown or unavailable marketplace agent: %', new.agent_key;
    end if;

    new.display_name := marketplace.name;
    new.setup_price := 0;
    new.monthly_price := 0;
    new.currency := 'NGN';
    new.updated_at := now();
    return new;
  end if;

  select * into offering
  from public.agent_catalog_offerings
  where agent_key = new.agent_key and is_active = true;

  if offering.agent_key is null then
    raise exception 'Unknown or inactive agent offering: %', new.agent_key;
  end if;

  new.display_name := offering.display_name;
  new.setup_price := offering.setup_price;
  new.monthly_price := offering.monthly_price;
  new.currency := offering.currency;
  new.updated_at := now();
  return new;
end;
$$;
