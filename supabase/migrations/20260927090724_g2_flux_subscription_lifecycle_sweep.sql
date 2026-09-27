create or replace function public.sync_due_flux_subscription_wallets()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  scanned integer:=0;
  synced integer:=0;
  failed integer:=0;
begin
  for r in
    select id
    from public.organization_subscriptions
    where
      (status='trialing' and trial_ends_at is not null and trial_ends_at<=now())
      or (
        status in ('past_due','grace_period')
        and grace_period_end is not null
        and grace_period_end<=now()
      )
  loop
    scanned:=scanned+1;
    begin
      perform public.sync_flux_credit_wallet_from_subscription(r.id);
      synced:=synced+1;
    exception when others then
      failed:=failed+1;
    end;
  end loop;

  return jsonb_build_object(
    'scanned',scanned,
    'synced',synced,
    'failed',failed,
    'checkedAt',now()
  );
end;
$$;

revoke all on function public.sync_due_flux_subscription_wallets() from public,anon,authenticated;
grant execute on function public.sync_due_flux_subscription_wallets() to service_role;
