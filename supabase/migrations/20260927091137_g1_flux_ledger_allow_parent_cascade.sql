create or replace function public.prevent_flux_credit_ledger_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='DELETE' and pg_trigger_depth()>1 then
    return old;
  end if;
  raise exception 'flux_credit_ledger is immutable';
end;
$$;
