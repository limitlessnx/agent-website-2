begin;
do $$begin
 if to_regprocedure('public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb)') is null then raise exception 'Existing Flux accounting is required'; end if;
 if (select md5(prosrc) from pg_proc where oid='public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb)'::regprocedure)
   not in ('a43e1354c80b13d48424bd9684f49761','cad92f4730562aa51d724a20b217effb') then raise exception 'Flux debit function changed; review before applying'; end if;
end$$;
create table if not exists public.flux_credit_reservations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.flux_credit_wallets(organization_id) on delete cascade,
 idempotency_key text not null check(length(idempotency_key) between 1 and 256),
 request_fingerprint text not null check(request_fingerprint ~ '^[0-9a-f]{64}$'),
 action_key text not null check(action_key in ('web_ai','whatsapp_ai','ai_email','email_follow_up','whatsapp_follow_up_reminder','leo_chat','leo_voice_minute')),
 reserved_credits integer not null check(reserved_credits>0),
 status text not null default 'held' check(status in ('held','settled','released','needs_attention')),
 source text not null check(length(source) between 1 and 100),
 period_start timestamptz not null,period_end timestamptz,plan_code text not null,reason text,
 metadata jsonb not null default '{}',history jsonb not null default '[]',
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(organization_id,idempotency_key)
);
create index if not exists flux_credit_reservations_held_idx on public.flux_credit_reservations(organization_id) where status in ('held','needs_attention');
alter table public.flux_credit_reservations enable row level security;
revoke all on public.flux_credit_reservations from public,anon,authenticated;
grant select,insert,update on public.flux_credit_reservations to service_role;

create or replace function public.get_flux_credit_availability(p_organization_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('balance',w.balance,'reserved',coalesce(sum(r.reserved_credits),0),
   'available',greatest(0,w.balance-coalesce(sum(r.reserved_credits),0)))
 from public.flux_credit_wallets w left join public.flux_credit_reservations r
   on r.organization_id=w.organization_id and r.status in ('held','needs_attention')
 where w.organization_id=p_organization_id group by w.organization_id,w.balance;
$$;

create or replace function public.reserve_flux_credit_capacity(
 p_organization_id uuid,p_idempotency_key text,p_fingerprint text,p_action_key text,p_credit_amount integer,p_source text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.flux_credit_wallets; r public.flux_credit_reservations; held bigint;
begin
 if p_organization_id is null or p_idempotency_key is null or length(btrim(p_idempotency_key)) not between 1 and 256
   or p_idempotency_key<>btrim(p_idempotency_key) or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
   or p_credit_amount is null or p_credit_amount<=0 or p_source is null or length(btrim(p_source)) not between 1 and 100
   or p_action_key is null or p_action_key not in ('web_ai','whatsapp_ai','ai_email','email_follow_up','whatsapp_follow_up_reminder','leo_chat','leo_voice_minute') then
   raise exception 'Invalid credit reservation request';
 end if;
 select * into w from public.flux_credit_wallets where organization_id=p_organization_id for update;
 if not found then raise exception 'Flux credit wallet is unavailable'; end if;
 select * into r from public.flux_credit_reservations where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if r.request_fingerprint<>p_fingerprint or r.action_key<>p_action_key or r.reserved_credits<>p_credit_amount or r.source<>p_source then
     raise exception 'Credit reservation conflicts with its original execution';
   end if;
   return to_jsonb(r)||jsonb_build_object('created',false);
 end if;
 if w.status not in ('active','trialing') or (w.trial_ends_at is not null and w.trial_ends_at<=clock_timestamp()) then
   raise exception 'Flux credit wallet cannot authorize new work';
 end if;
 if (w.trial_ends_at is not null or w.trial_credit_limit is not null) and p_action_key not in ('web_ai','whatsapp_ai') then
   raise exception 'Action is not included in the free trial';
 end if;
 select coalesce(sum(reserved_credits),0) into held from public.flux_credit_reservations
   where organization_id=p_organization_id and status in ('held','needs_attention');
 if w.balance-held<p_credit_amount then raise exception 'Flux Credit capacity is unavailable'; end if;
 insert into public.flux_credit_reservations(organization_id,idempotency_key,request_fingerprint,action_key,reserved_credits,source,period_start,period_end,plan_code,history)
 values(p_organization_id,p_idempotency_key,p_fingerprint,p_action_key,p_credit_amount,p_source,w.current_period_start,w.current_period_end,w.plan_code,
   jsonb_build_array(jsonb_build_object('status','held','at',clock_timestamp()))) returning * into r;
 return to_jsonb(r)||jsonb_build_object('created',true);
end;
$$;

create or replace function public.finish_flux_credit_capacity(
 p_organization_id uuid,p_reservation_id uuid,p_outcome text,p_reason text default null,
 p_provider text default null,p_provider_cost_cents numeric default 0,p_provider_usage jsonb default '{}',p_metadata jsonb default '{}'
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.flux_credit_wallets; r public.flux_credit_reservations; next_status text; next_reason text;
begin
 if p_outcome is null or p_outcome not in ('settled','released','needs_attention') then raise exception 'Invalid reservation outcome'; end if;
 if coalesce(p_provider_cost_cents,0)<0 or coalesce(p_provider_cost_cents,0)::text in ('NaN','Infinity','-Infinity')
   or jsonb_typeof(coalesce(p_provider_usage,'{}'))<>'object' or jsonb_typeof(coalesce(p_metadata,'{}'))<>'object' then
   raise exception 'Invalid reservation evidence';
 end if;
 select * into w from public.flux_credit_wallets where organization_id=p_organization_id for update;
 if not found then raise exception 'Flux credit wallet is unavailable'; end if;
 select * into r from public.flux_credit_reservations where id=p_reservation_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Credit reservation was not found inside the organization'; end if;
 if r.status in ('settled','released') then return to_jsonb(r); end if;
 next_status:=p_outcome; next_reason:=left(coalesce(p_reason,p_outcome),100);
 if p_outcome='settled' then
   if w.current_period_start is distinct from r.period_start or w.current_period_end is distinct from r.period_end then
     next_status:='needs_attention'; next_reason:='billing_period_changed';
   elsif w.plan_code is distinct from r.plan_code then
     next_status:='needs_attention'; next_reason:='plan_changed';
   elsif w.status not in ('active','trialing') or (w.trial_ends_at is not null and w.trial_ends_at<=clock_timestamp()) then
     next_status:='needs_attention'; next_reason:='wallet_unavailable';
   else
     begin
       -- Removing this hold and recording actual consumption commit together.
       update public.flux_credit_reservations set status='settled' where id=r.id;
       perform public.record_flux_credit_usage(p_organization_id,r.action_key,r.reserved_credits,r.source,p_provider,
         coalesce(p_provider_cost_cents,0),coalesce(p_provider_usage,'{}'),
         coalesce(p_metadata,'{}')||jsonb_build_object('credit_reservation_id',r.id,'credit_idempotency_key',r.idempotency_key));
     exception when others then
       -- Both the provisional state and debit roll back before review is recorded.
       next_status:='needs_attention'; next_reason:='settlement_failed';
     end;
   end if;
 end if;
 update public.flux_credit_reservations set status=next_status,reason=next_reason,
   metadata=metadata||coalesce(p_metadata,'{}')||jsonb_build_object('provider',p_provider),
   history=history||jsonb_build_array(jsonb_build_object('status',next_status,'reason',next_reason,'at',clock_timestamp())),
   updated_at=clock_timestamp()
 where id=r.id returning * into r;
 return to_jsonb(r);
end;
$$;
CREATE OR REPLACE FUNCTION public.record_flux_credit_usage(target_organization_id uuid, target_action_key text, target_credit_amount integer, target_source text DEFAULT 'app'::text, target_provider text DEFAULT NULL::text, target_provider_cost_cents numeric DEFAULT 0, target_provider_usage jsonb DEFAULT '{}'::jsonb, target_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS flux_credit_wallets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  wallet public.flux_credit_wallets;
  next_balance integer;
begin
  if target_credit_amount <= 0 then
    raise exception 'target_credit_amount must be positive';
  end if;

  select * into wallet from public.flux_credit_wallets where organization_id = target_organization_id for update;
  if wallet.organization_id is null then
    raise exception 'Flux credit wallet not found for organization %', target_organization_id;
  end if;
  if wallet.trial_ends_at is not null and wallet.trial_ends_at <= now() then
    update public.flux_credit_wallets set balance = 0, status = 'paused', updated_at = now() where organization_id = target_organization_id returning * into wallet;
    raise exception 'Basic trial expired. Chargeable AI must hand off to a human operator.';
  end if;
  if wallet.status in ('paused','suspended','cancelled') or wallet.balance < target_credit_amount then
    update public.flux_credit_wallets set status = 'paused', updated_at = now() where organization_id = target_organization_id returning * into wallet;
    raise exception 'Flux Credits exhausted. Chargeable AI must hand off to a human operator.';
  end if;

  if wallet.balance - coalesce((select sum(r.reserved_credits) from public.flux_credit_reservations r
      where r.organization_id=target_organization_id and r.status in ('held','needs_attention')),0) < target_credit_amount then
    raise exception 'Flux Credit capacity is reserved for in-progress work.';
  end if;

  next_balance := wallet.balance - target_credit_amount;
  update public.flux_credit_wallets
  set balance = next_balance,
      status = case when next_balance <= 0 then 'paused' else wallet.status end,
      updated_at = now()
  where organization_id = target_organization_id
  returning * into wallet;

  insert into public.flux_credit_ledger (
    organization_id,
    wallet_organization_id,
    transaction_type,
    action_key,
    credit_delta,
    balance_after,
    source,
    provider,
    provider_cost_cents,
    customer_value_cents,
    provider_usage,
    metadata
  ) values (
    target_organization_id,
    target_organization_id,
    'usage',
    target_action_key,
    -target_credit_amount,
    wallet.balance,
    target_source,
    target_provider,
    coalesce(target_provider_cost_cents, 0),
    target_credit_amount,
    coalesce(target_provider_usage, '{}'::jsonb),
    coalesce(target_metadata, '{}'::jsonb)
  );

  return wallet;
end;
$function$;

revoke all on function public.get_flux_credit_availability(uuid) from public,anon,authenticated;
revoke all on function public.reserve_flux_credit_capacity(uuid,text,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.finish_flux_credit_capacity(uuid,uuid,text,text,text,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.get_flux_credit_availability(uuid) to service_role;
grant execute on function public.reserve_flux_credit_capacity(uuid,text,text,text,integer,text) to service_role;
grant execute on function public.finish_flux_credit_capacity(uuid,uuid,text,text,text,numeric,jsonb,jsonb) to service_role;
revoke all on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb) to service_role;
commit;
