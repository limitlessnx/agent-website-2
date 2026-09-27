CREATE OR REPLACE FUNCTION public.prevent_flux_credit_ledger_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='DELETE' and pg_trigger_depth()>1 then
    return old;
  end if;
  raise exception 'flux_credit_ledger is immutable';
end;
$function$
;