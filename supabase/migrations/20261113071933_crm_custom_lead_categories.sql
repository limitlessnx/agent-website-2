-- Gencouv email centre: tenant-scoped custom CRM labels.
-- Categories are user-defined. Removing a category never removes a customer.
create table if not exists public.crm_lead_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index if not exists crm_lead_categories_org_name_uq
  on public.crm_lead_categories (organization_id, lower(trim(name)));
create index if not exists crm_lead_categories_org_idx on public.crm_lead_categories (organization_id);

create unique index if not exists crm_customers_id_org_unique_idx
  on public.crm_customers (id, organization_id);

create table if not exists public.crm_customer_category_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  category_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, customer_id, category_id),
  foreign key (customer_id, organization_id)
    references public.crm_customers(id, organization_id) on delete cascade,
  foreign key (category_id, organization_id)
    references public.crm_lead_categories(id, organization_id) on delete cascade
);
create index if not exists crm_customer_category_assignments_category_idx
  on public.crm_customer_category_assignments (organization_id, category_id);

alter table public.crm_lead_categories enable row level security;
alter table public.crm_customer_category_assignments enable row level security;
-- No public/anon policies: server-side organization authorization must be enforced
-- before using a service-role client. Do not expose service role credentials in browsers.
comment on table public.crm_lead_categories is 'User-created, organization-scoped lead tags; never hardcode trading/country labels.';
comment on table public.crm_customer_category_assignments is 'Many-to-many customer tags, scoped to the same organization on both foreign keys.';
