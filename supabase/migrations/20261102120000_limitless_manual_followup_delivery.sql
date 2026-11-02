begin;
alter table public.limitless_maia_followup_drafts drop constraint if exists limitless_maia_followup_drafts_status_check;
alter table public.limitless_maia_followup_drafts add constraint limitless_maia_followup_drafts_status_check check (status in ('draft','approved','rejected','cancelled','sending','sent','failed'));
alter table public.limitless_maia_followup_drafts add column if not exists provider_message_id text, add column if not exists sent_at timestamptz, add column if not exists delivery_error text;
create index if not exists limitless_maia_followup_drafts_org_sent_idx on public.limitless_maia_followup_drafts (organization_id,status,sent_at desc);
commit;
