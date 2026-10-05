-- Enforce tenant-safe lead ownership and prevent duplicate contact numbers within one organization.
create unique index if not exists leads_organization_phone_unique_idx
  on public.leads (organization_id, phone)
  where phone is not null and btrim(phone) <> '';

comment on index public.leads_organization_phone_unique_idx
  is 'Tenant-scoped uniqueness for lead phone numbers.';
