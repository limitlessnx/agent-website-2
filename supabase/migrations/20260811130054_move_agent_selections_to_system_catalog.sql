alter table public.organization_agent_selections
  drop constraint if exists organization_agent_selections_agent_key_fkey;

alter table public.organization_agent_selections
  add column if not exists system_catalog_id uuid;

update public.organization_agent_selections s
set system_catalog_id = c.id
from public.system_catalog c
where s.system_catalog_id is null
  and c.category = 'core'
  and replace(c.slug, '-', '_') = s.agent_key;

alter table public.organization_agent_selections
  drop constraint if exists organization_agent_selections_system_catalog_id_fkey;

alter table public.organization_agent_selections
  add constraint organization_agent_selections_system_catalog_id_fkey
  foreign key (system_catalog_id)
  references public.system_catalog(id)
  on delete restrict;

create index if not exists organization_agent_selections_system_catalog_id_idx
  on public.organization_agent_selections(system_catalog_id);
