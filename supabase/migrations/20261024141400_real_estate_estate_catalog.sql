begin;

-- Estate profiles are tenant-owned business content. Listings remain canonical in
-- public.properties; the nullable estate_id below is the only relationship added.
create table public.real_estate_estates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 240),
  description text,
  location text,
  address text,
  contact_name text,
  contact_email text,
  contact_phone text,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  cover_image_url text,
  payment_terms jsonb not null default '{}'::jsonb,
  operating_instructions text,
  knowledge_status text not null default 'draft'
    check (knowledge_status in ('draft','approved')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index real_estate_estates_org_status_idx
  on public.real_estate_estates(organization_id, status, updated_at desc);
create index real_estate_estates_org_knowledge_idx
  on public.real_estate_estates(organization_id, knowledge_status, updated_at desc);
create index real_estate_estates_org_name_idx
  on public.real_estate_estates(organization_id, lower(name));

create table public.real_estate_estate_faqs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estate_id uuid not null,
  question text not null check (length(btrim(question)) between 1 and 1000),
  answer text not null check (length(btrim(answer)) between 1 and 10000),
  category text,
  sort_order integer not null default 0 check (sort_order >= 0),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, estate_id)
    references public.real_estate_estates(organization_id, id) on delete cascade
);

create index real_estate_estate_faqs_org_estate_order_idx
  on public.real_estate_estate_faqs(organization_id, estate_id, sort_order, created_at);

-- Preserve canonical property rows and all existing media/fields. This is a
-- nullable relationship, so removing an estate assignment never removes a listing.
alter table public.properties
  add column if not exists estate_id uuid;

-- Targeted addition: the composite FK is safe whether the hardening migration
-- already created this unique index or not.
create unique index if not exists properties_org_id_unique
  on public.properties(organization_id, id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'properties_tenant_estate_fkey'
      and conrelid = 'public.properties'::regclass
  ) then
    alter table public.properties
      add constraint properties_tenant_estate_fkey
      foreign key (organization_id, estate_id)
      references public.real_estate_estates(organization_id, id)
      on delete set null (estate_id);
  end if;
end $$;

create index if not exists properties_org_estate_idx
  on public.properties(organization_id, estate_id)
  where estate_id is not null;

create trigger set_real_estate_estates_updated_at
before update on public.real_estate_estates
for each row execute function public.set_updated_at();

create trigger set_real_estate_estate_faqs_updated_at
before update on public.real_estate_estate_faqs
for each row execute function public.set_updated_at();

alter table public.real_estate_estates enable row level security;
alter table public.real_estate_estate_faqs enable row level security;

revoke all on public.real_estate_estates, public.real_estate_estate_faqs from public, anon;
grant select, insert, update, delete on public.real_estate_estates, public.real_estate_estate_faqs to authenticated;
grant all on public.real_estate_estates, public.real_estate_estate_faqs to service_role;

-- Tenant isolation and operation authorization are both enforced in PostgreSQL.
create policy real_estate_estates_member_read on public.real_estate_estates
for select to authenticated using (public.is_organization_member(organization_id));
create policy real_estate_estates_authorized_write on public.real_estate_estates
for all to authenticated
using (public.has_organization_permission(organization_id,'customers.manage') and public.has_organization_permission(organization_id,'knowledge.manage'))
with check (public.has_organization_permission(organization_id,'customers.manage') and public.has_organization_permission(organization_id,'knowledge.manage'));
create policy real_estate_estate_faqs_member_read on public.real_estate_estate_faqs
for select to authenticated using (public.is_organization_member(organization_id));
create policy real_estate_estate_faqs_authorized_write on public.real_estate_estate_faqs
for all to authenticated
using (public.has_organization_permission(organization_id,'knowledge.manage'))
with check (public.has_organization_permission(organization_id,'knowledge.manage'));

commit;
