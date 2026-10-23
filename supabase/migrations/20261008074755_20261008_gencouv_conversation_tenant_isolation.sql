alter table public.gencouv_support_conversations
  add column if not exists organization_id uuid;

update public.gencouv_support_conversations
set organization_id = (
  select id from public.organizations where slug = 'gencouv' limit 1
)
where organization_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gencouv_support_conversations_organization_id_fkey'
  ) then
    alter table public.gencouv_support_conversations
      add constraint gencouv_support_conversations_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
end $$;

create index if not exists gencouv_support_conversations_org_updated_idx
  on public.gencouv_support_conversations(organization_id, updated_at desc);

alter table public.gencouv_support_conversations
  alter column organization_id set not null;
