-- Maia high-frequency scheduler for Vercel Hobby deployments.
-- The scheduler token itself is intentionally NOT stored in source control.
-- Production stores it in Supabase Vault as `maia_scheduler_secret`.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.verify_maia_scheduler_secret(candidate text)
returns boolean
language sql
security definer
set search_path = public, vault
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'maia_scheduler_secret'
      and decrypted_secret = candidate
  );
$$;

revoke all on function public.verify_maia_scheduler_secret(text) from public, anon, authenticated;
grant execute on function public.verify_maia_scheduler_secret(text) to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'maia-high-frequency-scheduler';

select cron.schedule(
  'maia-high-frequency-scheduler',
  '*/5 * * * *',
  $$
    select net.http_get(
      url := 'https://limitlessnx-agent-website-2.vercel.app/api/cron/maia-safety-net',
      headers := jsonb_build_object(
        'x-maia-scheduler-token',
        (select decrypted_secret from vault.decrypted_secrets where name = 'maia_scheduler_secret')
      ),
      timeout_milliseconds := 10000
    );
  $$
);
