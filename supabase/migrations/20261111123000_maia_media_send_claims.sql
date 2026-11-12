-- Atomic media-send claims; fail closed if the claim cannot be recorded.
create table if not exists public.maia_media_send_claims (
  organization_id uuid not null,
  command_key text not null,
  asset_id uuid not null,
  recipient text not null,
  status text not null default 'claimed' check (status in ('claimed','accepted','failed')),
  provider_message_id text,
  created_at timestamptz not null default now(),
  primary key (organization_id, command_key)
);
alter table public.maia_media_send_claims enable row level security;
-- Only server-side service role may claim media sends.
revoke all on public.maia_media_send_claims from anon, authenticated;
