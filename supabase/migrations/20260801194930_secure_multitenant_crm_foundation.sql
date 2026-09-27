begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.sync_payment_plan_total() from public, anon, authenticated;
alter function public.update_updated_at_column() set search_path = pg_catalog, public;
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.slugify_identifier(text) set search_path = pg_catalog, public;
alter function public.set_whatsapp_template_config_updated_at() set search_path = pg_catalog, public;

create table public.crm_customers (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 external_key text, full_name text, email text, phone text, company_name text,
 status text not null default 'active' check (status in ('active','inactive','blocked','archived')),
 profile jsonb not null default '{}'::jsonb, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (organization_id,id), unique (organization_id,external_key)
);
create unique index crm_customers_org_email_unique on public.crm_customers (organization_id,lower(email)) where email is not null;
create unique index crm_customers_org_phone_unique on public.crm_customers (organization_id,phone) where phone is not null;

create table public.crm_leads (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_id uuid not null, assigned_agent_id uuid, source text,
 stage text not null default 'new' check (stage in ('new','qualified','contacted','nurturing','appointment','won','lost','disqualified')),
 score numeric, value_estimate numeric, currency text not null default 'NGN', summary text,
 details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (organization_id,id),
 foreign key (organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade,
 foreign key (organization_id,assigned_agent_id) references public.agents(organization_id,id) on delete set null
);

create table public.crm_conversations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_id uuid not null, agent_id uuid,
 channel text not null check (channel in ('whatsapp','email','web','telegram','voice','sms','internal')),
 external_thread_id text, status text not null default 'open' check (status in ('open','ai_active','human_active','waiting','resolved','closed')),
 started_at timestamptz not null default now(), ended_at timestamptz, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
 foreign key (organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade,
 foreign key (organization_id,agent_id) references public.agents(organization_id,id) on delete set null
);
create unique index crm_conversations_external_thread_unique on public.crm_conversations(organization_id,channel,external_thread_id) where external_thread_id is not null;

create table public.crm_messages (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null, agent_id uuid,
 sender_type text not null check (sender_type in ('customer','agent','human','system','tool')),
 direction text not null check (direction in ('inbound','outbound','internal')),
 content_type text not null default 'text', content text, external_message_id text,
 status text not null default 'received' check (status in ('received','queued','sent','delivered','read','failed')),
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique (organization_id,id),
 foreign key (organization_id,conversation_id) references public.crm_conversations(organization_id,id) on delete cascade,
 foreign key (organization_id,agent_id) references public.agents(organization_id,id) on delete set null
);
create unique index crm_messages_external_message_unique on public.crm_messages(organization_id,external_message_id) where external_message_id is not null;

create table public.crm_tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_id uuid, lead_id uuid, assigned_agent_id uuid, task_type text not null, title text not null, description text,
 status text not null default 'pending' check (status in ('pending','scheduled','in_progress','completed','cancelled','failed')),
 due_at timestamptz, completed_at timestamptz, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
 foreign key (organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade,
 foreign key (organization_id,lead_id) references public.crm_leads(organization_id,id) on delete cascade,
 foreign key (organization_id,assigned_agent_id) references public.agents(organization_id,id) on delete set null
);

create table public.channel_bindings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 integration_id uuid not null, agent_id uuid not null,
 channel text not null check (channel in ('whatsapp','email','web','telegram','voice','sms')),
 routing_key_type text not null, routing_key text not null, display_address text,
 status text not null default 'pending' check (status in ('pending','active','paused','error','disconnected')),
 configuration jsonb not null default '{}'::jsonb, health jsonb not null default '{}'::jsonb,
 last_verified_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (organization_id,id),
 foreign key (organization_id,integration_id) references public.organization_integrations(organization_id,id) on delete cascade,
 foreign key (organization_id,agent_id) references public.agents(organization_id,id) on delete cascade
);
create unique index channel_bindings_active_route_unique on public.channel_bindings(channel,routing_key_type,routing_key) where status='active';

create table public.billing_plans (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, currency text not null default 'NGN',
 installation_fee numeric not null default 0 check (installation_fee>=0), recurring_fee numeric not null default 0 check (recurring_fee>=0),
 billing_interval text not null default 'monthly' check (billing_interval in ('monthly','quarterly','yearly','custom')),
 status text not null default 'active' check (status in ('draft','active','archived')),
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.plan_entitlements (
 id uuid primary key default gen_random_uuid(), plan_id uuid not null references public.billing_plans(id) on delete cascade,
 feature_key text not null, enabled boolean not null default true, limit_value numeric,
 configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(plan_id,feature_key)
);
create table public.organization_subscriptions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 plan_id uuid not null references public.billing_plans(id), provider text, provider_customer_id text, provider_subscription_id text,
 status text not null default 'pending' check (status in ('pending','trialing','active','past_due','grace_period','suspended','cancelled')),
 current_period_start timestamptz, current_period_end timestamptz, grace_period_end timestamptz,
 metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,id)
);
create unique index organization_subscriptions_one_current on public.organization_subscriptions(organization_id) where status in ('pending','trialing','active','past_due','grace_period','suspended');
create unique index organization_subscriptions_provider_unique on public.organization_subscriptions(provider,provider_subscription_id) where provider_subscription_id is not null;
create table public.organization_entitlements (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 feature_key text not null, enabled boolean not null default true, limit_value numeric,
 source text not null default 'override' check (source in ('plan','override','promotion','admin')),
 expires_at timestamptz, configuration jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,feature_key)
);
create table public.consent_records (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_id uuid not null, channel text not null check (channel in ('whatsapp','email','voice','sms','all')),
 consent_type text not null, status text not null check (status in ('granted','revoked','unknown')), source text,
 captured_at timestamptz not null default now(), revoked_at timestamptz, evidence jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), unique(organization_id,id),
 foreign key (organization_id,customer_id) references public.crm_customers(organization_id,id) on delete cascade
);

create trigger set_crm_customers_updated_at before update on public.crm_customers for each row execute function public.set_updated_at();
create trigger set_crm_leads_updated_at before update on public.crm_leads for each row execute function public.set_updated_at();
create trigger set_crm_conversations_updated_at before update on public.crm_conversations for each row execute function public.set_updated_at();
create trigger set_crm_tasks_updated_at before update on public.crm_tasks for each row execute function public.set_updated_at();
create trigger set_channel_bindings_updated_at before update on public.channel_bindings for each row execute function public.set_updated_at();
create trigger set_billing_plans_updated_at before update on public.billing_plans for each row execute function public.set_updated_at();
create trigger set_plan_entitlements_updated_at before update on public.plan_entitlements for each row execute function public.set_updated_at();
create trigger set_organization_subscriptions_updated_at before update on public.organization_subscriptions for each row execute function public.set_updated_at();
create trigger set_organization_entitlements_updated_at before update on public.organization_entitlements for each row execute function public.set_updated_at();

alter table public.crm_customers enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_conversations enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.channel_bindings enable row level security;
alter table public.billing_plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.organization_entitlements enable row level security;
alter table public.consent_records enable row level security;

create policy crm_customers_member_access on public.crm_customers for all to authenticated using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy crm_leads_member_access on public.crm_leads for all to authenticated using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy crm_conversations_member_access on public.crm_conversations for all to authenticated using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy crm_messages_member_access on public.crm_messages for all to authenticated using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy crm_tasks_member_access on public.crm_tasks for all to authenticated using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));
create policy channel_bindings_member_select on public.channel_bindings for select to authenticated using(public.is_organization_member(organization_id));
create policy channel_bindings_member_manage on public.channel_bindings for all to authenticated using(public.has_organization_permission(organization_id,'integrations.manage')) with check(public.has_organization_permission(organization_id,'integrations.manage'));
create policy billing_plans_authenticated_select on public.billing_plans for select to authenticated using(status='active');
create policy plan_entitlements_authenticated_select on public.plan_entitlements for select to authenticated using(exists(select 1 from public.billing_plans bp where bp.id=plan_id and bp.status='active'));
create policy organization_subscriptions_member_select on public.organization_subscriptions for select to authenticated using(public.is_organization_member(organization_id));
create policy organization_entitlements_member_select on public.organization_entitlements for select to authenticated using(public.is_organization_member(organization_id));
create policy consent_records_member_access on public.consent_records for all to authenticated using(public.is_organization_member(organization_id)) with check(public.is_organization_member(organization_id));

grant select,insert,update,delete on public.crm_customers,public.crm_leads,public.crm_conversations,public.crm_messages,public.crm_tasks,public.consent_records to authenticated;
grant select on public.channel_bindings,public.billing_plans,public.plan_entitlements,public.organization_subscriptions,public.organization_entitlements to authenticated;
grant insert,update,delete on public.channel_bindings to authenticated;
commit;
