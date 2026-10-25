begin;
create unique index if not exists knowledge_sources_org_id_unique on public.knowledge_sources(organization_id,id);
create table public.real_estate_estate_knowledge_links (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estate_id uuid not null,
  knowledge_source_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(organization_id,estate_id,knowledge_source_id),
  foreign key(organization_id,estate_id) references public.real_estate_estates(organization_id,id) on delete cascade,
  foreign key(organization_id,knowledge_source_id) references public.knowledge_sources(organization_id,id) on delete cascade
);
alter table public.real_estate_estate_knowledge_links enable row level security;
revoke all on public.real_estate_estate_knowledge_links from public,anon;
grant select,insert,delete on public.real_estate_estate_knowledge_links to authenticated;
grant all on public.real_estate_estate_knowledge_links to service_role;
create policy real_estate_estate_knowledge_read on public.real_estate_estate_knowledge_links for select to authenticated using(public.is_organization_member(organization_id));
create policy real_estate_estate_knowledge_write on public.real_estate_estate_knowledge_links for all to authenticated using(public.has_organization_permission(organization_id,'knowledge.manage')) with check(public.has_organization_permission(organization_id,'knowledge.manage'));
commit;
