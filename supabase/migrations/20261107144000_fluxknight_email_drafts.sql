-- Fluxknight system-only proposal drafts.
-- All access through authenticated server routes with service role; no public RLS policies.
create table if not exists public.fluxknight_email_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  sender text not null check (sender in ('limitless@fluxknight.space', 'info@fluxknight.space')),
  recipient text not null default '',
  subject text not null default '',
  body text not null default '',
  template text not null default 'blank',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fluxknight_email_drafts_owner_length check (length(owner_email) between 3 and 254),
  constraint fluxknight_email_drafts_body_length check (length(body) <= 30000),
  constraint fluxknight_email_drafts_subject_length check (length(subject) <= 200)
);
create index if not exists fluxknight_email_drafts_owner_updated_idx
  on public.fluxknight_email_drafts (owner_email, updated_at desc);
alter table public.fluxknight_email_drafts enable row level security;
revoke all on public.fluxknight_email_drafts from anon, authenticated;
