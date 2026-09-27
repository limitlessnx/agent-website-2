alter table public.bot_sessions add column if not exists updated_at timestamptz not null default now(); update public.bot_sessions set updated_at = coalesce(updated_at, created_at, now());
