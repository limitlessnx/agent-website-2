alter table public.gencouv_email_messages
  add column if not exists direction text not null default 'outbound',
  add column if not exists from_email text,
  add column if not exists reply_to_message_id uuid references public.gencouv_email_messages(id) on delete set null,
  add column if not exists message_id_header text,
  add column if not exists in_reply_to_header text,
  add column if not exists references_header text,
  add column if not exists text_body text,
  add column if not exists html_body text,
  add column if not exists is_auto_reply boolean not null default false,
  add column if not exists read_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists replied_from_dashboard_at timestamptz,
  add column if not exists stop_reason text;

create index if not exists gencouv_email_messages_direction_idx
  on public.gencouv_email_messages(direction);

create index if not exists gencouv_email_messages_message_id_header_idx
  on public.gencouv_email_messages(message_id_header);

create index if not exists gencouv_email_messages_in_reply_to_header_idx
  on public.gencouv_email_messages(in_reply_to_header);

create index if not exists gencouv_email_messages_recipient_direction_idx
  on public.gencouv_email_messages(recipient_email, direction);

create table if not exists public.gencouv_campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_key text not null default 'gencouv_long_form_copy_trading',
  lead_id text,
  normalized_email text not null,
  cohort_date date not null,
  campaign_status text not null default 'queued',
  validation_status text not null default 'pending',
  qualification_status text not null default 'pending',
  current_sequence_step integer not null default 0,
  next_follow_up_at timestamptz,
  campaign_enrolled_at timestamptz,
  last_email_sent_at timestamptz,
  last_delivery_status text,
  last_event_at timestamptz,
  reply_status text not null default 'none',
  replied_at timestamptz,
  bounce_status text,
  suppression_status text,
  unsubscribe_status text,
  do_not_contact boolean not null default false,
  stop_reason text,
  resend_contact_id text,
  resend_automation_run_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gencouv_campaign_enrollments_unique_active unique (organization_id, campaign_key, normalized_email)
);

create index if not exists gencouv_campaign_enrollments_cohort_idx
  on public.gencouv_campaign_enrollments(cohort_date);

create index if not exists gencouv_campaign_enrollments_status_idx
  on public.gencouv_campaign_enrollments(campaign_status);

create table if not exists public.gencouv_rejected_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source text,
  source_id text,
  lead_id text,
  email text,
  normalized_email text,
  rejection_reason text not null,
  validation_result text,
  processing_status text not null default 'rejected',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gencouv_rejected_leads_created_idx
  on public.gencouv_rejected_leads(created_at);

create index if not exists gencouv_rejected_leads_normalized_email_idx
  on public.gencouv_rejected_leads(normalized_email);
