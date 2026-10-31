begin;
create table if not exists public.limitless_maia_followup_drafts (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 lead_id uuid not null references public.leads(id) on delete cascade,
 property_id uuid not null references public.properties(id) on delete restrict,
 reason text not null,
 notes text,
 eligibility_snapshot jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check (status in ('draft','approved','rejected','cancelled')),
 created_by text not null,
 reviewed_by text,
 reviewed_at timestamptz,
 review_note text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint limitless_maia_followup_draft_reason_nonempty check (length(trim(reason)) > 0)
);
create index if not exists limitless_maia_followup_drafts_org_status_idx on public.limitless_maia_followup_drafts (organization_id,status,created_at desc);
create index if not exists limitless_maia_followup_drafts_lead_idx on public.limitless_maia_followup_drafts (organization_id,lead_id,created_at desc);
alter table public.limitless_maia_followup_drafts enable row level security;
revoke all on table public.limitless_maia_followup_drafts from public,anon,authenticated;
grant select,insert,update on table public.limitless_maia_followup_drafts to service_role;
drop policy if exists limitless_maia_followup_drafts_service_role on public.limitless_maia_followup_drafts;
create policy limitless_maia_followup_drafts_service_role on public.limitless_maia_followup_drafts for all to service_role using (true) with check (true);
commit;
