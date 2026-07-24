create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.membership_roles (
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, role_id)
);

create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'deprecated')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_families (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.agent_templates(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_family_id uuid not null references public.agent_families(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_family_id, slug)
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_family_id uuid not null references public.agent_families(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  system_prompt text,
  status text not null default 'draft' check (status in ('draft', 'testing', 'published', 'paused', 'deprecated')),
  current_version integer not null default 1,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  impersonated_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.workflow_registry add column if not exists organization_uuid uuid references public.organizations(id) on delete cascade;
alter table public.workflow_registry add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.workflow_registry add column if not exists agent_family_id uuid references public.agent_families(id) on delete set null;
alter table public.workflow_registry add column if not exists project_uuid uuid references public.projects(id) on delete set null;
alter table public.workflow_registry add column if not exists agent_id uuid references public.agents(id) on delete set null;
alter table public.workflow_registry add column if not exists trigger_type text not null default 'webhook';
alter table public.workflow_registry add column if not exists environment text not null default 'production' check (environment in ('development', 'preview', 'staging', 'production'));

alter table public.workflow_runs add column if not exists organization_uuid uuid references public.organizations(id) on delete cascade;
alter table public.workflow_runs add column if not exists branch_id uuid references public.branches(id) on delete set null;
alter table public.workflow_runs add column if not exists agent_family_id uuid references public.agent_families(id) on delete set null;
alter table public.workflow_runs add column if not exists project_uuid uuid references public.projects(id) on delete set null;
alter table public.workflow_runs add column if not exists agent_id uuid references public.agents(id) on delete set null;

create index if not exists branches_org_idx on public.branches(organization_id, status);
create index if not exists memberships_org_user_idx on public.organization_memberships(organization_id, user_id);
create index if not exists agent_families_org_idx on public.agent_families(organization_id, status);
create index if not exists projects_family_idx on public.projects(agent_family_id, status);
create index if not exists agents_project_idx on public.agents(project_id, status);
create index if not exists audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);
create index if not exists workflow_registry_family_status_idx on public.workflow_registry(agent_family_id, status);
create index if not exists workflow_runs_family_created_idx on public.workflow_runs(agent_family_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'branches',
    'roles',
    'organization_memberships',
    'agent_templates',
    'agent_families',
    'projects',
    'agents'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.agent_templates enable row level security;
alter table public.agent_families enable row level security;
alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.audit_logs enable row level security;

insert into public.organizations (name, slug)
values ('Fluxknight', 'fluxknight')
on conflict (slug) do update set name = excluded.name;

insert into public.agent_templates (name, slug, industry, description, status)
values (
  'Real Estate Sales and Support',
  'real-estate-sales-support',
  'real-estate',
  'Reusable real-estate lead qualification, property recommendation, inspection booking, follow-up, and human handoff template.',
  'published'
)
on conflict (slug) do update set
  name = excluded.name,
  industry = excluded.industry,
  description = excluded.description,
  status = excluded.status;

insert into public.agent_families (organization_id, template_id, name, slug, description, status)
select
  organization.id,
  template.id,
  'Limitless Realty',
  'limitless-realty',
  'Limitless Realty agent family and business operations.',
  'active'
from public.organizations organization
join public.agent_templates template on template.slug = 'real-estate-sales-support'
where organization.slug = 'fluxknight'
on conflict (organization_id, slug) do update set
  name = excluded.name,
  template_id = excluded.template_id,
  description = excluded.description,
  status = excluded.status;

insert into public.projects (organization_id, agent_family_id, name, slug, description, status)
select
  organization.id,
  family.id,
  'Maia Real Estate Agent',
  'maia',
  'Customer-facing AI real-estate assistant and workflow project.',
  'active'
from public.organizations organization
join public.agent_families family on family.organization_id = organization.id and family.slug = 'limitless-realty'
where organization.slug = 'fluxknight'
on conflict (agent_family_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status;

insert into public.agents (organization_id, agent_family_id, project_id, name, slug, description, status)
select
  organization.id,
  family.id,
  project.id,
  'Maia',
  'maia',
  'Limitless Realty customer-facing AI assistant.',
  'draft'
from public.organizations organization
join public.agent_families family on family.organization_id = organization.id and family.slug = 'limitless-realty'
join public.projects project on project.agent_family_id = family.id and project.slug = 'maia'
where organization.slug = 'fluxknight'
on conflict (project_id, slug) do update set
  name = excluded.name,
  description = excluded.description;

update public.workflow_registry registry
set
  organization_uuid = organization.id,
  agent_family_id = family.id,
  project_uuid = project.id
from public.organizations organization
join public.agent_families family on family.organization_id = organization.id and family.slug = 'limitless-realty'
join public.projects project on project.agent_family_id = family.id and project.slug = 'maia'
where registry.organization_id = 'limitless-realty'
  and organization.slug = 'fluxknight'
  and registry.organization_uuid is null;

update public.workflow_runs run
set
  organization_uuid = registry.organization_uuid,
  agent_family_id = registry.agent_family_id,
  project_uuid = registry.project_uuid,
  agent_id = registry.agent_id
from public.workflow_registry registry
where run.workflow_id = registry.id
  and run.organization_uuid is null;

comment on table public.organizations is 'Top-level Fluxknight tenant records.';
comment on table public.agent_templates is 'Reusable platform agent-family templates without tenant business data.';
comment on table public.agent_families is 'Tenant-owned installed agent-family instances.';
comment on table public.projects is 'Operational projects inside an agent family.';
comment on table public.agents is 'Versioned AI agents owned by a project and agent family.';
comment on table public.audit_logs is 'Immutable privileged-action history for tenant and platform administration.';
