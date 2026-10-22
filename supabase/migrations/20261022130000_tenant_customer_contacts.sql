-- Tenant-owned customer contacts for reminders and consent-aware messaging.
create table if not exists public.tenant_customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 180),
  email text,
  phone text,
  birthday date,
  anniversary date,
  tags text[] not null default '{}',
  whatsapp_consent text not null default 'unknown' check (whatsapp_consent in ('unknown','opted_in','opted_out')),
  email_consent text not null default 'unknown' check (email_consent in ('unknown','opted_in','opted_out')),
  consent_source text,
  consent_recorded_at timestamptz,
  source text not null default 'manual',
  external_key text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index if not exists tenant_customer_contacts_org_name_idx on public.tenant_customer_contacts (organization_id, full_name);
create index if not exists tenant_customer_contacts_org_phone_idx on public.tenant_customer_contacts (organization_id, phone) where phone is not null;
create index if not exists tenant_customer_contacts_org_birthday_idx on public.tenant_customer_contacts (organization_id, birthday) where birthday is not null;
create index if not exists tenant_customer_contacts_org_anniversary_idx on public.tenant_customer_contacts (organization_id, anniversary) where anniversary is not null;
create unique index if not exists tenant_customer_contacts_org_phone_unique on public.tenant_customer_contacts (organization_id, phone) where phone is not null and phone <> '';
create unique index if not exists tenant_customer_contacts_org_email_unique on public.tenant_customer_contacts (organization_id, lower(email)) where email is not null and email <> '';
alter table public.tenant_customer_contacts enable row level security;
revoke all on public.tenant_customer_contacts from public, anon, authenticated;
grant all on public.tenant_customer_contacts to service_role;
comment on table public.tenant_customer_contacts is 'Tenant-specific customer directory. Consent defaults to unknown and external messaging must require explicit opt-in.';
