create table if not exists public.social_content_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null,
  week_start date not null,
  status text not null default 'generated' check (status in ('generated','review','archived')),
  strategy jsonb not null default '{}'::jsonb,
  model text,
  generated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, brand_id, week_start),
  constraint social_content_plans_brand_fk foreign key (organization_id, brand_id)
    references public.social_brands(organization_id, id) on delete cascade
);

alter table public.social_posts
  add column if not exists content_plan_id uuid;

create index if not exists social_content_plans_org_week_idx
  on public.social_content_plans (organization_id, week_start desc);
create index if not exists social_posts_content_plan_idx
  on public.social_posts (organization_id, content_plan_id)
  where content_plan_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'social_posts_content_plan_fk'
  ) then
    alter table public.social_posts
      add constraint social_posts_content_plan_fk
      foreign key (organization_id, content_plan_id)
      references public.social_content_plans(organization_id, id)
      on delete set null;
  end if;
end $$;

alter table public.social_content_plans enable row level security;

drop policy if exists social_content_plans_tenant_all on public.social_content_plans;
create policy social_content_plans_tenant_all
  on public.social_content_plans
  for all
  to authenticated
  using (public.is_organization_member(organization_id))
  with check (public.is_organization_member(organization_id));

grant select, insert, update, delete on public.social_content_plans to authenticated;
grant all on public.social_content_plans to service_role;

drop trigger if exists social_content_plans_set_updated_at on public.social_content_plans;
create trigger social_content_plans_set_updated_at
before update on public.social_content_plans
for each row execute function public.set_updated_at();
