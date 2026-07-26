create table if not exists public.organization_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  industry text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  modules jsonb not null default '[]'::jsonb,
  agents jsonb not null default '[]'::jsonb,
  workflows jsonb not null default '[]'::jsonb,
  knowledge_structure jsonb not null default '[]'::jsonb,
  integration_requirements jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_template_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.organization_templates(id) on delete restrict,
  status text not null default 'provisioning' check (status in ('provisioning','active','paused','failed')),
  provisioned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_id)
);

create table if not exists public.organization_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  display_name text not null,
  status text not null default 'disconnected' check (status in ('disconnected','connected','degraded','error','paused')),
  credential_reference text,
  configuration jsonb not null default '{}'::jsonb,
  health jsonb not null default '{}'::jsonb,
  last_checked_at timestamptz,
  last_connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);

create table if not exists public.knowledge_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  source_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection_id uuid references public.knowledge_collections(id) on delete set null,
  title text not null,
  source_type text not null default 'text',
  source_url text,
  content text,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed','archived')),
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_memories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_key text not null,
  memory_type text not null,
  summary text not null,
  confidence numeric(5,4) not null default 1,
  source_type text,
  source_id text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_integrations_org_idx on public.organization_integrations(organization_id, status);
create index if not exists knowledge_collections_org_idx on public.knowledge_collections(organization_id, status);
create index if not exists knowledge_sources_org_idx on public.knowledge_sources(organization_id, status);
create index if not exists customer_memories_lookup_idx on public.customer_memories(organization_id, customer_key, memory_type);

insert into public.organization_templates (
  name, slug, industry, description, modules, agents, workflows, knowledge_structure, integration_requirements
) values
(
  'Real Estate AI Suite',
  'real-estate-ai-suite',
  'Real Estate',
  'CRM, property knowledge, WhatsApp sales, campaigns, follow-ups and payment operations.',
  '["crm","properties","campaigns","payments","analytics"]'::jsonb,
  '["ai_sales_agent","customer_support_agent","whatsapp_agent","lead_generation_agent"]'::jsonb,
  '["lead_capture","lead_qualification","property_recommendation","inspection_booking","follow_up","campaign_sender","payment_reminder"]'::jsonb,
  '["Properties","FAQs","Pricing","Installments","Policies","Developers","Inspection Guide","Sales Scripts"]'::jsonb,
  '["openai","supabase","n8n","whatsapp"]'::jsonb
),
(
  'Customer Support AI Suite',
  'customer-support-ai-suite',
  'Customer Service',
  'Omnichannel support, escalation, CRM and service analytics.',
  '["crm","support","knowledge","analytics"]'::jsonb,
  '["customer_support_agent","whatsapp_agent","voice_agent","email_automation"]'::jsonb,
  '["ticket_capture","intent_routing","human_handoff","follow_up","satisfaction_request"]'::jsonb,
  '["FAQs","Policies","Products","Troubleshooting","Escalation Guide"]'::jsonb,
  '["openai","supabase","n8n"]'::jsonb
),
(
  'Computer Service AI Suite',
  'computer-service-ai-suite',
  'Computer Sales and Repair',
  'Sales, repair intake, inventory enquiries, support and CRM automation.',
  '["crm","inventory","repairs","campaigns","analytics"]'::jsonb,
  '["ai_sales_agent","customer_support_agent","whatsapp_agent","crm_automation"]'::jsonb,
  '["lead_capture","repair_intake","inventory_lookup","follow_up","buyer_handoff"]'::jsonb,
  '["Inventory","Repairs","Warranty","Pricing","Returns","Troubleshooting"]'::jsonb,
  '["openai","supabase","n8n","whatsapp"]'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  industry = excluded.industry,
  description = excluded.description,
  modules = excluded.modules,
  agents = excluded.agents,
  workflows = excluded.workflows,
  knowledge_structure = excluded.knowledge_structure,
  integration_requirements = excluded.integration_requirements,
  updated_at = now();

comment on table public.organization_templates is 'Reusable Fluxknight organization provisioning blueprints.';
comment on table public.organization_integrations is 'Organization-scoped integration references and health state. Secrets remain outside readable table fields.';
comment on table public.knowledge_collections is 'Organization knowledge containers used by agents and retrieval workflows.';
comment on table public.customer_memories is 'Organization-scoped long-term customer memory records with provenance.';