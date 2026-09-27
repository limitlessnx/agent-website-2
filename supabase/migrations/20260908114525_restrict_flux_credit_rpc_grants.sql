create or replace function public.resolve_flux_monthly_allowance(target_plan_code text, configured_credits integer default null)
returns integer
language sql
immutable
set search_path = public
as $$
  select case target_plan_code
    when 'plus' then 5000
    when 'business' then 12000
    when 'business_plus' then greatest(coalesce(configured_credits, 25000), 25000)
    else 2500
  end;
$$;

create or replace function public.prevent_flux_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'flux_credit_ledger is immutable';
end;
$$;

revoke all on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.adjust_flux_credit_wallet(uuid,integer,text,text,text) from public, anon, authenticated;
revoke all on function public.resolve_flux_monthly_allowance(text,integer) from public, anon, authenticated;
revoke all on function public.prevent_flux_credit_ledger_mutation() from public, anon, authenticated;

grant execute on function public.ensure_flux_credit_wallet(uuid,text,integer,integer,timestamptz,timestamptz) to service_role;
grant execute on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) to service_role;
grant execute on function public.adjust_flux_credit_wallet(uuid,integer,text,text,text) to service_role;
