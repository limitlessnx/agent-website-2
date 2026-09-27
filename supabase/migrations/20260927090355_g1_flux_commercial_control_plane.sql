

revoke all on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) to service_role;
revoke all on function public.sync_flux_credit_wallet_from_subscription(uuid) from public,anon,authenticated;
grant execute on function public.sync_flux_credit_wallet_from_subscription(uuid) to service_role;
revoke all on function public.get_flux_commercial_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.get_flux_commercial_snapshot(uuid) to service_role;

DROP TRIGGER IF EXISTS flux_credit_wallet_threshold_notification ON public.flux_credit_wallets;
CREATE TRIGGER flux_credit_wallet_threshold_notification AFTER INSERT OR UPDATE OF balance, monthly_allowance, status, plan_code ON public.flux_credit_wallets FOR EACH ROW EXECUTE FUNCTION sync_flux_credit_threshold_notification();

DROP TRIGGER IF EXISTS organization_subscriptions_sync_flux_wallet ON public.organization_subscriptions;
CREATE TRIGGER organization_subscriptions_sync_flux_wallet AFTER INSERT OR UPDATE OF plan_id, status, current_period_start, current_period_end, grace_period_end, trial_ends_at, metadata ON public.organization_subscriptions FOR EACH ROW EXECUTE FUNCTION sync_flux_subscription_wallet_trigger();
