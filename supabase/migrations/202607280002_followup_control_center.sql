create extension if not exists pgcrypto;

create table if not exists public.followup_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft','active','paused','archived')),
  stop_on_reply boolean not null default true,
  stop_on_qualified boolean not null default true,
  stop_on_appointment boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.followup_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.followup_sequences(id) on delete cascade,
  position integer not null check (position > 0),
  channel text not null check (channel in ('whatsapp','email','call','telegram','task')),
  delay_value integer not null default 0 check (delay_value >= 0),
  delay_unit text not null default 'hours' check (delay_unit in ('minutes','hours','days')),
  title text,
  message_template text,
  workflow_id text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, position)
);

create table if not exists public.followup_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  sequence_id uuid not null references public.followup_sequences(id) on delete restrict,
  lead_id text not null,
  lead_name text,
  lead_phone text,
  status text not null default 'active' check (status in ('active','paused','completed','cancelled','failed')),
  current_step integer not null default 1,
  next_run_at timestamptz,
  last_run_at timestamptz,
  n8n_execution_id text,
  pause_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.followup_execution_log (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid references public.followup_enrollments(id) on delete cascade,
  sequence_id uuid references public.followup_sequences(id) on delete set null,
  step_id uuid references public.followup_sequence_steps(id) on delete set null,
  organization_id text not null,
  lead_id text,
  channel text,
  status text not null check (status in ('scheduled','running','sent','succeeded','failed','skipped','cancelled')),
  n8n_execution_id text,
  scheduled_for timestamptz,
  executed_at timestamptz,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists followup_enrollments_status_next_idx on public.followup_enrollments(organization_id,status,next_run_at);
create index if not exists followup_execution_status_idx on public.followup_execution_log(organization_id,status,created_at desc);
create index if not exists followup_steps_sequence_idx on public.followup_sequence_steps(sequence_id,position);

create or replace function public.set_followup_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists followup_sequences_updated_at on public.followup_sequences;
create trigger followup_sequences_updated_at before update on public.followup_sequences for each row execute function public.set_followup_updated_at();
drop trigger if exists followup_steps_updated_at on public.followup_sequence_steps;
create trigger followup_steps_updated_at before update on public.followup_sequence_steps for each row execute function public.set_followup_updated_at();
drop trigger if exists followup_enrollments_updated_at on public.followup_enrollments;
create trigger followup_enrollments_updated_at before update on public.followup_enrollments for each row execute function public.set_followup_updated_at();

alter table public.followup_sequences enable row level security;
alter table public.followup_sequence_steps enable row level security;
alter table public.followup_enrollments enable row level security;
alter table public.followup_execution_log enable row level security;

comment on table public.followup_sequences is 'Editable reusable follow-up sequences controlled by Fluxknight and executed by n8n.';
comment on table public.followup_enrollments is 'Contacts enrolled into variable-length follow-up sequences.';