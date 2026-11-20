-- Production schema-only snapshot (2026-11-20); no customer rows, credentials or production triggers.
-- Retains internal foreign keys/defaults/check constraints; external stage/domain references omitted.
create sequence runtime_progress_events_id_seq;
create table public.organizations (id uuid default gen_random_uuid() not null,name text not null,slug text not null,status text default 'active'::text not null,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null,manager_access_code text not null);
create table public.branches (id uuid default gen_random_uuid() not null,organization_id uuid not null,name text not null,slug text not null,status text default 'active'::text not null,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.agent_families (id uuid default gen_random_uuid() not null,organization_id uuid not null,template_id uuid,branch_id uuid,name text not null,slug text not null,description text,status text default 'active'::text not null,configuration jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.projects (id uuid default gen_random_uuid() not null,organization_id uuid not null,agent_family_id uuid not null,branch_id uuid,name text not null,slug text not null,description text,status text default 'active'::text not null,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.agents (id uuid default gen_random_uuid() not null,organization_id uuid not null,agent_family_id uuid not null,project_id uuid not null,branch_id uuid,name text not null,slug text not null,description text,system_prompt text,status text default 'draft'::text not null,current_version integer default 1 not null,configuration jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null,agent_type text,ai_model text,temperature numeric(3,2) default 0.30 not null,language text default 'English'::text not null,voice_provider text,communication_channels jsonb default '[]'::jsonb not null,escalation_rules jsonb default '[]'::jsonb not null,human_handoff_destination jsonb default '{}'::jsonb not null,knowledge_sources jsonb default '[]'::jsonb not null);
create table public.audit_logs (id uuid default gen_random_uuid() not null,organization_id uuid,branch_id uuid,actor_user_id uuid,impersonated_user_id uuid,action text not null,resource_type text not null,resource_id text,reason text,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null);
create table public.customer_memories (id uuid default gen_random_uuid() not null,organization_id uuid not null,customer_key text not null,memory_type text not null,summary text not null,confidence numeric(5,4) default 1 not null,source_type text,source_id text,expires_at timestamp with time zone,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.crm_customers (id uuid default gen_random_uuid() not null,organization_id uuid not null,external_key text,full_name text,email text,phone text,company_name text,status text default 'active'::text not null,profile jsonb default '{}'::jsonb not null,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null,current_stage_id uuid,stage_updated_at timestamp with time zone);
create table public.crm_leads (id uuid default gen_random_uuid() not null,organization_id uuid not null,customer_id uuid not null,assigned_agent_id uuid,source text,stage text default 'new'::text not null,score numeric,value_estimate numeric,currency text default 'NGN'::text not null,summary text,details jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.crm_tasks (id uuid default gen_random_uuid() not null,organization_id uuid not null,customer_id uuid,lead_id uuid,assigned_agent_id uuid,task_type text not null,title text not null,description text,status text default 'pending'::text not null,due_at timestamp with time zone,completed_at timestamp with time zone,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.runtime_progress_events (id bigint default nextval('runtime_progress_events_id_seq'::regclass) not null,organization_id uuid not null,execution_id uuid not null,event_type text not null,message text,payload jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null);
create table public.customer_profiles (id uuid default gen_random_uuid() not null,organization_id uuid not null,external_key text,full_name text,email text,phone text,company text,attributes jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.agent_conversations (id uuid default gen_random_uuid() not null,organization_id uuid not null,agent_id uuid not null,customer_id uuid,channel text not null,external_thread_key text,status text default 'open'::text not null,current_stage text,assigned_user_id uuid,ai_paused boolean default false not null,last_message_at timestamp with time zone,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.conversation_messages (id uuid default gen_random_uuid() not null,organization_id uuid not null,conversation_id uuid not null,sender_type text not null,sender_id uuid,content_type text default 'text'::text not null,content text,payload jsonb default '{}'::jsonb not null,provider_message_id text,created_at timestamp with time zone default now() not null);
create table public.runtime_executions (id uuid default gen_random_uuid() not null,organization_id uuid not null,agent_id uuid not null,conversation_id uuid,event_id uuid,prompt_version integer,status text default 'queued'::text not null,execution_context jsonb default '{}'::jsonb not null,input jsonb default '{}'::jsonb not null,output jsonb,error_code text,error_message text,latency_ms integer,token_usage jsonb default '{}'::jsonb not null,cost_minor bigint default 0 not null,started_at timestamp with time zone,completed_at timestamp with time zone,created_at timestamp with time zone default now() not null);
create table public.command_queue (id uuid default gen_random_uuid() not null,organization_id uuid not null,agent_id uuid not null,execution_id uuid,command_type text not null,payload jsonb default '{}'::jsonb not null,status text default 'queued'::text not null,priority integer default 100 not null,attempts integer default 0 not null,max_attempts integer default 3 not null,available_at timestamp with time zone default now() not null,claimed_at timestamp with time zone,completed_at timestamp with time zone,last_error text,idempotency_key text,created_at timestamp with time zone default now() not null);
create table public.handoff_requests (id uuid default gen_random_uuid() not null,organization_id uuid not null,conversation_id uuid not null,agent_id uuid not null,reason text not null,priority text default 'normal'::text not null,status text default 'open'::text not null,assigned_user_id uuid,notes text,created_at timestamp with time zone default now() not null,resolved_at timestamp with time zone);
create table public.usage_ledger (id uuid default gen_random_uuid() not null,organization_id uuid not null,agent_id uuid,execution_id uuid,usage_type text not null,quantity numeric not null,unit_cost_minor numeric default 0 not null,total_cost_minor numeric generated always as ((quantity * unit_cost_minor)) stored,metadata jsonb default '{}'::jsonb not null,occurred_at timestamp with time zone default now() not null);
create table public.flux_credit_wallets (organization_id uuid not null,plan_code text default 'basic'::text not null,monthly_allowance integer default 2500 not null,balance integer default 0 not null,bonus_balance integer default 0 not null,top_up_balance integer default 0 not null,trial_credit_limit integer,trial_ends_at timestamp with time zone,current_period_start timestamp with time zone default now() not null,current_period_end timestamp with time zone,status text default 'active'::text not null,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null);
create table public.flux_credit_ledger (id uuid default gen_random_uuid() not null,organization_id uuid not null,wallet_organization_id uuid not null,transaction_type text not null,action_key text default 'manual'::text not null,credit_delta integer not null,balance_after integer not null,source text,provider text,provider_cost_cents numeric(18,4) default 0 not null,customer_value_cents numeric(18,4) default 0 not null,provider_usage jsonb default '{}'::jsonb not null,metadata jsonb default '{}'::jsonb not null,reason text,created_by text,created_at timestamp with time zone default now() not null);
alter table public.organizations add PRIMARY KEY (id);
alter table public.organizations add UNIQUE (slug);
alter table public.organizations add CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'archived'::text])));
alter table public.branches add UNIQUE (organization_id, slug);
alter table public.branches add PRIMARY KEY (id);
alter table public.branches add CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'archived'::text])));
alter table public.agent_families add UNIQUE (organization_id, slug);
alter table public.agent_families add PRIMARY KEY (id);
alter table public.agent_families add CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text])));
alter table public.projects add UNIQUE (agent_family_id, slug);
alter table public.projects add PRIMARY KEY (id);
alter table public.projects add CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'archived'::text])));
alter table public.agents add UNIQUE (organization_id, id);
alter table public.agents add PRIMARY KEY (id);
alter table public.agents add UNIQUE (project_id, slug);
alter table public.agents add CHECK ((status = ANY (ARRAY['draft'::text, 'testing'::text, 'published'::text, 'paused'::text, 'deprecated'::text])));
alter table public.agents add CHECK (((temperature >= (0)::numeric) AND (temperature <= (2)::numeric)));
alter table public.audit_logs add PRIMARY KEY (id);
alter table public.customer_memories add PRIMARY KEY (id);
alter table public.crm_customers add UNIQUE (organization_id, external_key);
alter table public.crm_customers add UNIQUE (organization_id, id);
alter table public.crm_customers add PRIMARY KEY (id);
alter table public.crm_customers add CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'blocked'::text, 'archived'::text])));
alter table public.crm_leads add UNIQUE (organization_id, id);
alter table public.crm_leads add PRIMARY KEY (id);
alter table public.crm_leads add CHECK ((stage = ANY (ARRAY['new'::text, 'qualified'::text, 'contacted'::text, 'nurturing'::text, 'appointment'::text, 'won'::text, 'lost'::text, 'disqualified'::text])));
alter table public.crm_tasks add UNIQUE (organization_id, id);
alter table public.crm_tasks add PRIMARY KEY (id);
alter table public.crm_tasks add CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text, 'failed'::text])));
alter table public.runtime_progress_events add PRIMARY KEY (id);
alter table public.customer_profiles add UNIQUE (organization_id, external_key);
alter table public.customer_profiles add UNIQUE (organization_id, id);
alter table public.customer_profiles add PRIMARY KEY (id);
alter table public.agent_conversations add CHECK ((channel = ANY (ARRAY['whatsapp'::text, 'email'::text, 'web_chat'::text, 'telegram'::text, 'voice'::text])));
alter table public.agent_conversations add UNIQUE (organization_id, channel, external_thread_key);
alter table public.agent_conversations add UNIQUE (organization_id, id);
alter table public.agent_conversations add PRIMARY KEY (id);
alter table public.agent_conversations add CHECK ((status = ANY (ARRAY['open'::text, 'waiting'::text, 'human_handoff'::text, 'closed'::text, 'archived'::text])));
alter table public.conversation_messages add UNIQUE (organization_id, id);
alter table public.conversation_messages add PRIMARY KEY (id);
alter table public.conversation_messages add CHECK ((sender_type = ANY (ARRAY['customer'::text, 'agent'::text, 'human'::text, 'system'::text, 'tool'::text])));
alter table public.runtime_executions add UNIQUE (organization_id, id);
alter table public.runtime_executions add PRIMARY KEY (id);
alter table public.runtime_executions add CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'blocked'::text, 'cancelled'::text])));
alter table public.command_queue add UNIQUE (organization_id, id);
alter table public.command_queue add UNIQUE (organization_id, idempotency_key);
alter table public.command_queue add PRIMARY KEY (id);
alter table public.command_queue add CHECK ((status = ANY (ARRAY['queued'::text, 'claimed'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'dead_letter'::text, 'cancelled'::text])));
alter table public.handoff_requests add PRIMARY KEY (id);
alter table public.handoff_requests add CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
alter table public.handoff_requests add CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'resolved'::text, 'cancelled'::text])));
alter table public.usage_ledger add PRIMARY KEY (id);
alter table public.usage_ledger add CHECK ((usage_type = ANY (ARRAY['ai_tokens'::text, 'voice_seconds'::text, 'whatsapp_message'::text, 'email_message'::text, 'workflow_execution'::text, 'storage_bytes'::text, 'api_call'::text])));
alter table public.flux_credit_wallets add CHECK ((balance >= 0));
alter table public.flux_credit_wallets add CHECK ((bonus_balance >= 0));
alter table public.flux_credit_wallets add CHECK ((monthly_allowance >= 0));
alter table public.flux_credit_wallets add PRIMARY KEY (organization_id);
alter table public.flux_credit_wallets add CHECK ((plan_code = ANY (ARRAY['basic'::text, 'plus'::text, 'business'::text, 'business_plus'::text])));
alter table public.flux_credit_wallets add CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'paused'::text, 'suspended'::text, 'cancelled'::text])));
alter table public.flux_credit_wallets add CHECK ((top_up_balance >= 0));
alter table public.flux_credit_wallets add CHECK (((trial_credit_limit IS NULL) OR (trial_credit_limit >= 0)));
alter table public.flux_credit_ledger add CHECK ((balance_after >= 0));
alter table public.flux_credit_ledger add CHECK ((customer_value_cents >= (0)::numeric));
alter table public.flux_credit_ledger add PRIMARY KEY (id);
alter table public.flux_credit_ledger add CHECK ((provider_cost_cents >= (0)::numeric));
alter table public.flux_credit_ledger add CHECK ((transaction_type = ANY (ARRAY['monthly_allowance'::text, 'trial_grant'::text, 'usage'::text, 'bonus'::text, 'top_up'::text, 'adjustment'::text, 'refund'::text, 'expiry'::text])));
alter table public.branches add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.agent_families add FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
alter table public.agent_families add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.projects add FOREIGN KEY (agent_family_id) REFERENCES agent_families(id) ON DELETE CASCADE;
alter table public.projects add FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
alter table public.projects add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.agents add FOREIGN KEY (agent_family_id) REFERENCES agent_families(id) ON DELETE CASCADE;
alter table public.agents add FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
alter table public.agents add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.agents add FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table public.audit_logs add FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;
alter table public.audit_logs add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
alter table public.customer_memories add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.crm_customers add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.crm_leads add FOREIGN KEY (organization_id, assigned_agent_id) REFERENCES agents(organization_id, id) ON DELETE SET NULL;
alter table public.crm_leads add FOREIGN KEY (organization_id, customer_id) REFERENCES crm_customers(organization_id, id) ON DELETE CASCADE;
alter table public.crm_leads add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.crm_tasks add FOREIGN KEY (organization_id, assigned_agent_id) REFERENCES agents(organization_id, id) ON DELETE SET NULL;
alter table public.crm_tasks add FOREIGN KEY (organization_id, customer_id) REFERENCES crm_customers(organization_id, id) ON DELETE CASCADE;
alter table public.crm_tasks add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.crm_tasks add FOREIGN KEY (organization_id, lead_id) REFERENCES crm_leads(organization_id, id) ON DELETE CASCADE;
alter table public.runtime_progress_events add FOREIGN KEY (organization_id, execution_id) REFERENCES runtime_executions(organization_id, id) ON DELETE CASCADE;
alter table public.runtime_progress_events add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.customer_profiles add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.agent_conversations add FOREIGN KEY (organization_id, agent_id) REFERENCES agents(organization_id, id) ON DELETE CASCADE;
alter table public.agent_conversations add FOREIGN KEY (organization_id, customer_id) REFERENCES customer_profiles(organization_id, id) ON DELETE SET NULL;
alter table public.agent_conversations add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.conversation_messages add FOREIGN KEY (organization_id, conversation_id) REFERENCES agent_conversations(organization_id, id) ON DELETE CASCADE;
alter table public.conversation_messages add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.runtime_executions add FOREIGN KEY (organization_id, agent_id) REFERENCES agents(organization_id, id) ON DELETE CASCADE;
alter table public.runtime_executions add FOREIGN KEY (organization_id, conversation_id) REFERENCES agent_conversations(organization_id, id) ON DELETE SET NULL;
alter table public.runtime_executions add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.command_queue add FOREIGN KEY (organization_id, agent_id) REFERENCES agents(organization_id, id) ON DELETE CASCADE;
alter table public.command_queue add FOREIGN KEY (organization_id, execution_id) REFERENCES runtime_executions(organization_id, id) ON DELETE CASCADE;
alter table public.command_queue add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.handoff_requests add FOREIGN KEY (organization_id, agent_id) REFERENCES agents(organization_id, id) ON DELETE CASCADE;
alter table public.handoff_requests add FOREIGN KEY (organization_id, conversation_id) REFERENCES agent_conversations(organization_id, id) ON DELETE CASCADE;
alter table public.handoff_requests add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.usage_ledger add FOREIGN KEY (organization_id, agent_id) REFERENCES agents(organization_id, id) ON DELETE CASCADE;
alter table public.usage_ledger add FOREIGN KEY (organization_id, execution_id) REFERENCES runtime_executions(organization_id, id) ON DELETE SET NULL;
alter table public.usage_ledger add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.flux_credit_wallets add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.flux_credit_ledger add FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.flux_credit_ledger add FOREIGN KEY (wallet_organization_id) REFERENCES flux_credit_wallets(organization_id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.record_flux_credit_usage(target_organization_id uuid, target_action_key text, target_credit_amount integer, target_source text DEFAULT 'app'::text, target_provider text DEFAULT NULL::text, target_provider_cost_cents numeric DEFAULT 0, target_provider_usage jsonb DEFAULT '{}'::jsonb, target_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS flux_credit_wallets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  wallet public.flux_credit_wallets;
  next_balance integer;
begin
  if target_credit_amount <= 0 then
    raise exception 'target_credit_amount must be positive';
  end if;

  select * into wallet from public.flux_credit_wallets where organization_id = target_organization_id for update;
  if wallet.organization_id is null then
    raise exception 'Flux credit wallet not found for organization %', target_organization_id;
  end if;
  if wallet.trial_ends_at is not null and wallet.trial_ends_at <= now() then
    update public.flux_credit_wallets set balance = 0, status = 'paused', updated_at = now() where organization_id = target_organization_id returning * into wallet;
    raise exception 'Basic trial expired. Chargeable AI must hand off to a human operator.';
  end if;
  if wallet.status in ('paused','suspended','cancelled') or wallet.balance < target_credit_amount then
    update public.flux_credit_wallets set status = 'paused', updated_at = now() where organization_id = target_organization_id returning * into wallet;
    raise exception 'Flux Credits exhausted. Chargeable AI must hand off to a human operator.';
  end if;

  if wallet.balance - coalesce((select sum(r.reserved_credits) from public.flux_credit_reservations r
      where r.organization_id=target_organization_id and r.status in ('held','needs_attention')),0) < target_credit_amount then
    raise exception 'Flux Credit capacity is reserved for in-progress work.';
  end if;

  next_balance := wallet.balance - target_credit_amount;
  update public.flux_credit_wallets
  set balance = next_balance,
      status = case when next_balance <= 0 then 'paused' else wallet.status end,
      updated_at = now()
  where organization_id = target_organization_id
  returning * into wallet;

  insert into public.flux_credit_ledger (
    organization_id,
    wallet_organization_id,
    transaction_type,
    action_key,
    credit_delta,
    balance_after,
    source,
    provider,
    provider_cost_cents,
    customer_value_cents,
    provider_usage,
    metadata
  ) values (
    target_organization_id,
    target_organization_id,
    'usage',
    target_action_key,
    -target_credit_amount,
    wallet.balance,
    target_source,
    target_provider,
    coalesce(target_provider_cost_cents, 0),
    target_credit_amount,
    coalesce(target_provider_usage, '{}'::jsonb),
    coalesce(target_metadata, '{}'::jsonb)
  );

  return wallet;
end;
$function$
;
