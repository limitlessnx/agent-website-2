begin;

create table if not exists public.automation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text not null default 'operations',
  channels text[] not null default '{}',
  required_plan text,
  setup_price numeric(14,2) not null default 0 check (setup_price >= 0),
  recurring_price numeric(14,2) not null default 0 check (recurring_price >= 0),
  currency text not null default 'NGN',
  configuration_schema jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','available','paused','deprecated')),
  latest_approved_version integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_template_versions (
  id uuid primary key default gen_random_uuid(),
  automation_template_id uuid not null references public.automation_templates(id) on delete cascade,
  version integer not null check (version > 0),
  source_n8n_workflow_id text not null,
  source_n8n_workflow_name text,
  configuration_defaults jsonb not null default '{}'::jsonb,
  validation_notes text,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_template_id, version)
);

create table if not exists public.organization_automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_template_id uuid not null references public.automation_templates(id) on delete restrict,
  automation_template_version_id uuid not null references public.automation_template_versions(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  quote_item_id uuid references public.organization_quote_items(id) on delete set null,
  display_name text not null,
  status text not null default 'payment_pending' check (status in ('payment_pending','queued','provisioning','active','paused','needs_attention','failed','cancelled')),
  client_configuration jsonb not null default '{}'::jsonb,
  backend_workflow_id text,
  backend_workflow_name text,
  provisioned_version integer not null,
  activated_at timestamptz,
  paused_at timestamptz,
  last_error text,
  last_provisioning_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, automation_template_id)
);

create table if not exists public.automation_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  organization_automation_id uuid not null references public.organization_automations(id) on delete cascade,
  automation_template_version_id uuid not null references public.automation_template_versions(id) on delete restrict,
  payment_attempt_id uuid references public.payment_attempts(id) on delete set null,
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  locked_at timestamptz,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organization_quote_items drop constraint if exists organization_quote_items_item_type_check;
alter table public.organization_quote_items add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.organization_quote_items
  add constraint organization_quote_items_item_type_check
  check (item_type in ('agent','automation','channel','usage','setup','discount','custom'));

alter table public.automation_templates enable row level security;
alter table public.automation_template_versions enable row level security;
alter table public.organization_automations enable row level security;
alter table public.automation_provisioning_jobs enable row level security;

grant select on public.automation_templates to authenticated;
grant all on public.automation_templates to service_role;
grant all on public.automation_template_versions to service_role;
grant all on public.organization_automations to service_role;
grant all on public.automation_provisioning_jobs to service_role;

drop policy if exists "authenticated_view_available_automation_templates" on public.automation_templates;
create policy "authenticated_view_available_automation_templates"
on public.automation_templates for select to authenticated
using (status = 'available');

create index if not exists automation_template_versions_template_status_idx
on public.automation_template_versions(automation_template_id, status, version desc);

create index if not exists organization_automations_org_status_idx
on public.organization_automations(organization_id, status);

create index if not exists automation_provisioning_jobs_ready_idx
on public.automation_provisioning_jobs(status, available_at);

create unique index if not exists automation_provisioning_one_active_job_idx
on public.automation_provisioning_jobs(organization_automation_id, automation_template_version_id)
where status in ('queued','running','completed');

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'automation_templates',
    'automation_template_versions',
    'organization_automations',
    'automation_provisioning_jobs'
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

create or replace function private.sync_latest_approved_automation_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.automation_templates template
  set latest_approved_version = (
    select max(version)
    from public.automation_template_versions version
    where version.automation_template_id = template.id and version.status = 'approved'
  )
  where template.id = coalesce(new.automation_template_id, old.automation_template_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists automation_template_versions_sync_latest on public.automation_template_versions;
create trigger automation_template_versions_sync_latest
after insert or update or delete on public.automation_template_versions
for each row execute function private.sync_latest_approved_automation_version();

create or replace function private.queue_automation_clone_for_paid_quote(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payment_attempts%rowtype;
  item record;
  template public.automation_templates%rowtype;
  version public.automation_template_versions%rowtype;
  installation_id uuid;
  job_key text;
begin
  select * into payment from public.payment_attempts where id = target_payment_id for update;
  if payment.id is null or payment.status <> 'paid' then
    raise exception 'Payment is not paid';
  end if;

  for item in
    select *
    from public.organization_quote_items
    where organization_id = payment.organization_id
      and quote_id = payment.quote_id
      and item_type = 'automation'
  loop
    select * into template
    from public.automation_templates
    where slug = item.item_key and status = 'available';

    if template.id is null then
      raise exception 'Automation template is not available: %', item.item_key;
    end if;

    select * into version
    from public.automation_template_versions
    where automation_template_id = template.id and status = 'approved'
    order by version desc
    limit 1;

    if version.id is null then
      raise exception 'Automation template has no approved version: %', item.item_key;
    end if;

    insert into public.organization_automations (
      organization_id,
      automation_template_id,
      automation_template_version_id,
      payment_attempt_id,
      quote_item_id,
      display_name,
      status,
      client_configuration,
      provisioned_version
    )
    values (
      payment.organization_id,
      template.id,
      version.id,
      payment.id,
      item.id,
      template.name,
      'queued',
      coalesce(item.metadata, '{}'::jsonb),
      version.version
    )
    on conflict (organization_id, automation_template_id)
    do update set
      automation_template_version_id = excluded.automation_template_version_id,
      payment_attempt_id = excluded.payment_attempt_id,
      quote_item_id = excluded.quote_item_id,
      status = case
        when public.organization_automations.backend_workflow_id is null then 'queued'
        else public.organization_automations.status
      end,
      client_configuration = public.organization_automations.client_configuration || excluded.client_configuration,
      provisioned_version = excluded.provisioned_version,
      last_error = null,
      updated_at = now()
    returning id into installation_id;

    job_key := payment.organization_id::text || ':' || template.id::text || ':v' || version.version::text;

    insert into public.automation_provisioning_jobs (
      organization_id,
      organization_automation_id,
      automation_template_version_id,
      payment_attempt_id,
      idempotency_key,
      payload
    )
    values (
      payment.organization_id,
      installation_id,
      version.id,
      payment.id,
      job_key,
      jsonb_build_object('quote_id', payment.quote_id, 'quote_item_id', item.id)
    )
    on conflict (idempotency_key) do nothing;
  end loop;
end;
$$;

revoke all on function private.queue_automation_clone_for_paid_quote(uuid) from public, anon, authenticated;

create or replace function private.queue_paid_quote_provisioning(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payment_attempts%rowtype;
  selection record;
begin
  select * into payment from public.payment_attempts where id = target_payment_id for update;
  if payment.id is null or payment.status <> 'paid' then raise exception 'Payment is not paid'; end if;

  update public.organization_quotes set status = 'paid', updated_at = now()
  where id = payment.quote_id and organization_id = payment.organization_id;

  insert into public.provisioning_jobs (organization_id, payment_attempt_id, job_type, payload)
  values
    (payment.organization_id, payment.id, 'activate_subscription', jsonb_build_object('quote_id', payment.quote_id)),
    (payment.organization_id, payment.id, 'create_crm_defaults', jsonb_build_object('quote_id', payment.quote_id)),
    (payment.organization_id, payment.id, 'create_channel_placeholders', jsonb_build_object('quote_id', payment.quote_id))
  on conflict do nothing;

  for selection in
    select id from public.organization_agent_selections
    where organization_id = payment.organization_id and status in ('selected','configured','quoted','payment_pending','paid')
  loop
    update public.organization_agent_selections set status = 'paid', updated_at = now() where id = selection.id;
    insert into public.provisioning_jobs (organization_id, payment_attempt_id, agent_selection_id, job_type)
    values (payment.organization_id, payment.id, selection.id, 'provision_agent')
    on conflict do nothing;
  end loop;

  perform private.queue_automation_clone_for_paid_quote(payment.id);
end;
$$;

revoke all on function private.queue_paid_quote_provisioning(uuid) from public, anon, authenticated;

with template_seed (slug, name, description, category, channels, required_plan, setup_price, recurring_price, source_workflow_id, source_workflow_name) as (
  values
    (
      'lead-intake-router',
      'Lead Intake Router',
      'Receives new lead events, normalizes tenant metadata, and prepares downstream routing.',
      'lead management',
      array['webhook','crm','voice'],
      'Starter',
      120000::numeric,
      45000::numeric,
      'puJ1r3si5v53wRrC',
      'TEMPLATE - Fluxknight - Lead Intake Router - v1'
    ),
    (
      'whatsapp-lead-follow-up',
      'WhatsApp Lead Follow-up',
      'Runs tenant-specific WhatsApp speed-to-lead and follow-up sequences.',
      'lead follow-up',
      array['whatsapp'],
      'Growth',
      180000::numeric,
      75000::numeric,
      'EU1prKH4zS1fHtfu',
      'TEMPLATE - Fluxknight - WhatsApp Lead Follow-up - v1'
    ),
    (
      'email-outreach',
      'Email Outreach',
      'Runs tenant-branded email follow-up, nurturing, and reactivation outreach.',
      'lead follow-up',
      array['email'],
      'Growth',
      180000::numeric,
      70000::numeric,
      '6Okw7cHyNbBdexFu',
      'TEMPLATE - Fluxknight - Email Outreach - v1'
    ),
    (
      'appointment-reminders',
      'Appointment Reminders',
      'Sends inspection, call, and meeting reminders using tenant-specific policies.',
      'scheduling',
      array['whatsapp','email','sms'],
      'Starter',
      150000::numeric,
      60000::numeric,
      'boiwSNmSnwKEPf1B',
      'TEMPLATE - Fluxknight - Appointment Reminders - v1'
    ),
    (
      'lead-qualification',
      'Lead Qualification',
      'Scores lead intent, urgency, fit, and handoff priority before agent action.',
      'qualification',
      array['ai','crm'],
      'Growth',
      220000::numeric,
      90000::numeric,
      'zQJspateXejAeRUA',
      'TEMPLATE - Fluxknight - Lead Qualification - v1'
    ),
    (
      'customer-support-handoff',
      'Customer Support Handoff',
      'Classifies customer requests and escalates support conversations to the right team.',
      'support',
      array['chat','email','whatsapp'],
      'Growth',
      220000::numeric,
      90000::numeric,
      'knor4qfnc6CbRZzt',
      'TEMPLATE - Fluxknight - Customer Support Handoff - v1'
    )
),
upserted_templates as (
  insert into public.automation_templates (
    slug,
    name,
    description,
    category,
    channels,
    required_plan,
    setup_price,
    recurring_price,
    currency,
    configuration_schema,
    status
  )
  select
    slug,
    name,
    description,
    category,
    channels,
    required_plan,
    setup_price,
    recurring_price,
    'NGN',
    jsonb_build_object(
      'type', 'object',
      'required', jsonb_build_array('organization_id'),
      'properties', jsonb_build_object(
        'organization_id', jsonb_build_object('type', 'string'),
        'organization_slug', jsonb_build_object('type', 'string'),
        'timezone', jsonb_build_object('type', 'string', 'default', 'Africa/Lagos')
      )
    ),
    'available'
  from template_seed
  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    channels = excluded.channels,
    required_plan = excluded.required_plan,
    setup_price = excluded.setup_price,
    recurring_price = excluded.recurring_price,
    currency = excluded.currency,
    configuration_schema = excluded.configuration_schema,
    status = excluded.status,
    updated_at = now()
  returning id, slug
)
insert into public.automation_template_versions (
  automation_template_id,
  version,
  source_n8n_workflow_id,
  source_n8n_workflow_name,
  configuration_defaults,
  validation_notes,
  status,
  approved_at
)
select
  upserted.id,
  1,
  seed.source_workflow_id,
  seed.source_workflow_name,
  jsonb_build_object(
    'timezone', 'Africa/Lagos',
    'template_source', 'n8n',
    'provisioning_model', 'dedicated_clone'
  ),
  'Approved source template for Fluxknight Option B dedicated tenant workflow cloning.',
  'approved',
  now()
from upserted_templates upserted
join template_seed seed on seed.slug = upserted.slug
on conflict (automation_template_id, version) do update set
  source_n8n_workflow_id = excluded.source_n8n_workflow_id,
  source_n8n_workflow_name = excluded.source_n8n_workflow_name,
  configuration_defaults = excluded.configuration_defaults,
  validation_notes = excluded.validation_notes,
  status = excluded.status,
  approved_at = coalesce(public.automation_template_versions.approved_at, excluded.approved_at),
  updated_at = now();

commit;
