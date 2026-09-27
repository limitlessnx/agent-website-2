create table if not exists public.gencouv_resend_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  email_id text,
  automation_id text,
  automation_run_id text,
  recipient_email text,
  recipient_domain text,
  template_id text,
  subject text,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gencouv_resend_events_event_type_idx
  on public.gencouv_resend_events (event_type);

create index if not exists gencouv_resend_events_email_id_idx
  on public.gencouv_resend_events (email_id);

create index if not exists gencouv_resend_events_occurred_at_idx
  on public.gencouv_resend_events (occurred_at desc);

alter table public.gencouv_resend_events enable row level security;

drop policy if exists "Service role manages Gencouv resend events" on public.gencouv_resend_events;
create policy "Service role manages Gencouv resend events"
  on public.gencouv_resend_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

insert into public.gencouv_resend_events (
  event_id,
  event_type,
  email_id,
  automation_id,
  automation_run_id,
  template_id,
  occurred_at,
  payload
) values
  ('reconciled_019fe3fd-da3a-7482-96ac-06123ef0fb8f_send_email_1', 'email.sent', 'd16b1c70-133f-4de2-9747-434b1f0cb541', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe3fd-da3a-7482-96ac-06123ef0fb8f', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T00:48:12.400058Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe419-e564-76f9-aba1-fae75f4a567c_send_email_1', 'email.sent', '16834523-b50a-45c5-9892-2909132f286e', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe419-e564-76f9-aba1-fae75f4a567c', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:18:50.274591Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe41a-d08f-74c8-a1c4-98b4c09d7015_send_email_1', 'email.sent', '00a5bd1d-97a9-4d5a-9dd7-01dd2ec6f447', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe41a-d08f-74c8-a1c4-98b4c09d7015', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:19:50.469853Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe41d-6034-7008-b069-abca0df9425f_send_email_1', 'email.sent', '22e90616-1b1e-440e-bb14-bb83c075d421', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe41d-6034-7008-b069-abca0df9425f', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:22:38.344404Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe41e-8d6d-758f-b57f-4184a075461d_send_email_1', 'email.sent', '276bb109-5317-4345-9a5b-8fb494524fc8', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe41e-8d6d-758f-b57f-4184a075461d', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:23:55.445505Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe41f-cad2-731b-97b0-f15993028256_send_email_1', 'email.sent', '0062cbe9-bdae-4209-ae2b-5c58b7bd2be5', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe41f-cad2-731b-97b0-f15993028256', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:25:16.679901Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe420-e3ef-7593-9506-dad84e509ae0_send_email_1', 'email.sent', 'd0d95faa-59e4-40b2-9b54-313d895e3bdf', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe420-e3ef-7593-9506-dad84e509ae0', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:26:28.733021Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb),
  ('reconciled_019fe421-d1ea-729c-a689-676088d3eb9a_send_email_1', 'email.sent', '19fdd40a-240b-4bf9-aa1a-c756a206c470', '019fe3fd-8e61-7600-bcbb-1184ceaefca6', '019fe421-d1ea-729c-a689-676088d3eb9a', '8a06c19a-dda1-42ab-a3ab-6ec3db860bd9', '2026-08-09T01:27:29.631233Z', '{"source":"resend_automation_run_reconciliation"}'::jsonb)
on conflict (event_id) do nothing;
