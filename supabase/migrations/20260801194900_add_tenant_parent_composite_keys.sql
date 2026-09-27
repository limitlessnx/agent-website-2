begin;

alter table public.agents
  add constraint agents_organization_id_id_key unique (organization_id, id);

alter table public.organization_integrations
  add constraint organization_integrations_organization_id_id_key unique (organization_id, id);

commit;
