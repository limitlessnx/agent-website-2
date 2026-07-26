create table if not exists public.ai_model_catalog (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_key text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','disabled')),
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, model_key)
);

create table if not exists public.organization_ai_model_assignments (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  model_id uuid not null references public.ai_model_catalog(id) on delete restrict,
  assigned_by uuid null references auth.users(id) on delete set null,
  settings jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_ai_model_assignments_model_idx
  on public.organization_ai_model_assignments(model_id);

alter table public.ai_model_catalog enable row level security;
alter table public.organization_ai_model_assignments enable row level security;

revoke all on public.ai_model_catalog from anon, authenticated;
revoke all on public.organization_ai_model_assignments from anon, authenticated;
grant all on public.ai_model_catalog to service_role;
grant all on public.organization_ai_model_assignments to service_role;

create or replace function public.touch_ai_model_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_ai_model_updated_at() from public, anon, authenticated;
grant execute on function public.touch_ai_model_updated_at() to service_role;

drop trigger if exists ai_model_catalog_touch_updated_at on public.ai_model_catalog;
create trigger ai_model_catalog_touch_updated_at
before update on public.ai_model_catalog
for each row execute function public.touch_ai_model_updated_at();

drop trigger if exists organization_ai_model_assignments_touch_updated_at on public.organization_ai_model_assignments;
create trigger organization_ai_model_assignments_touch_updated_at
before update on public.organization_ai_model_assignments
for each row execute function public.touch_ai_model_updated_at();

comment on table public.ai_model_catalog is 'Super-admin controlled catalog of AI models actually supported by Fluxknight.';
comment on table public.organization_ai_model_assignments is 'Single super-admin assigned AI model for each organization. Organization users cannot modify this assignment.';
