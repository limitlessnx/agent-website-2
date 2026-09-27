create or replace function public.enforce_fluxknight_subscription_grace_expiry()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
begin
  update public.organization_subscriptions
  set status='suspended',updated_at=now()
  where status='grace_period' and grace_period_end is not null and grace_period_end <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

do $$ begin
  if not exists (select 1 from cron.job where jobname='fluxknight_subscription_grace_expiry') then
    perform cron.schedule('fluxknight_subscription_grace_expiry','45 * * * *','select public.enforce_fluxknight_subscription_grace_expiry();');
  end if;
end $$;
