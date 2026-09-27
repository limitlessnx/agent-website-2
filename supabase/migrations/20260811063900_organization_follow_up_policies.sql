create table if not exists public.organization_follow_up_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references public.organizations(id) on delete cascade,
  organization_key text null,
  name text not null,
  status text not null default 'active' check (status in ('draft','active','paused','archived')),
  timezone text not null default 'Africa/Lagos',
  preferred_send_time time not null default '10:30',
  qualification jsonb not null default '{}'::jsonb,
  sequence jsonb not null default '[]'::jsonb,
  stop_conditions jsonb not null default '[]'::jsonb,
  channel_policy jsonb not null default '{}'::jsonb,
  message_strategy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_follow_up_policy_scope check (organization_id is not null or nullif(trim(organization_key),'') is not null)
);

create unique index if not exists organization_follow_up_policies_org_uidx
  on public.organization_follow_up_policies(organization_id)
  where organization_id is not null;
create unique index if not exists organization_follow_up_policies_key_uidx
  on public.organization_follow_up_policies(lower(organization_key))
  where organization_key is not null;

alter table public.organization_follow_up_policies enable row level security;

insert into public.organization_follow_up_policies (
  organization_key,name,status,timezone,preferred_send_time,qualification,sequence,stop_conditions,channel_policy,message_strategy
) values (
  'limitless-realty',
  'Limitless Realty property-interest follow-up',
  'active',
  'Africa/Lagos',
  '10:30',
  '{"require_specific_interest":true,"interest_field":"property_interest","require_meaningful_conversation":true,"exclude_campaign_only":true,"inactivity_hours":24,"require_opt_in":true}'::jsonb,
  '[{"step":1,"day":1,"purpose":"natural_check_in"},{"step":2,"day":3,"purpose":"property_value"},{"step":3,"day":7,"purpose":"identify_objection"},{"step":4,"day":14,"purpose":"investment_or_use_case_value"},{"step":5,"day":21,"purpose":"soft_reengagement"},{"step":6,"day":30,"purpose":"graceful_close_to_nurture"}]'::jsonb,
  '["customer_replied","appointment_booked","purchase_started","human_handoff","opted_out","property_unavailable","lead_won","lead_lost"]'::jsonb,
  '{"default_channel":"whatsapp","respect_customer_preference":true,"campaign_messages_do_not_start_follow_up":true}'::jsonb,
  '{"dynamic":true,"use_property_context":true,"use_conversation_context":true,"use_memory":true,"never_invent_property_facts":true,"final_step_moves_to_long_term_nurture":true}'::jsonb
)
on conflict (lower(organization_key)) where organization_key is not null do update set
  name=excluded.name,
  status=excluded.status,
  timezone=excluded.timezone,
  preferred_send_time=excluded.preferred_send_time,
  qualification=excluded.qualification,
  sequence=excluded.sequence,
  stop_conditions=excluded.stop_conditions,
  channel_policy=excluded.channel_policy,
  message_strategy=excluded.message_strategy,
  updated_at=now();
