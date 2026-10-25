begin;

-- A transport timeout or provider 5xx does not prove that the message was not
-- accepted. Keep it in an explicit non-retryable state until a person verifies.
alter table public.handoff_notifications
  add column if not exists error_code text,
  add column if not exists retry_count integer not null default 0;

do $$ begin
  alter table public.handoff_notifications
    add constraint handoff_notifications_retry_count_check check (retry_count between 0 and 3);
exception when duplicate_object then null; end $$;

alter table public.handoff_notifications
  drop constraint if exists handoff_notifications_status_check;
alter table public.handoff_notifications
  add constraint handoff_notifications_status_check
  check (status in ('pending','sent','delivered','read','failed','skipped','unknown'));

comment on column public.handoff_notifications.status is
  'unknown is a potentially accepted provider send; do not automatically retry it.';
comment on column public.handoff_notifications.retry_count is
  'Number of explicit operator retries after definitive provider rejection; maximum three.';

commit;
