create table if not exists public.gencouv_inner_circle_verifications (
  order_id text primary key references public.marketplace_orders(order_id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'awaiting_claim' check(status in ('awaiting_claim','pending_review','approved','rejected','revoked')),
  requested_at timestamptz,
  approved_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gencouv_inner_circle_verifications enable row level security;
revoke all on public.gencouv_inner_circle_verifications from anon,authenticated;
create index if not exists gencouv_inner_circle_verifications_status_idx on public.gencouv_inner_circle_verifications(status);
comment on table public.gencouv_inner_circle_verifications is 'Manual Telegram membership review. Only verified paid annual members may submit their unique claim code; approval is required before a private invite is shared.';
