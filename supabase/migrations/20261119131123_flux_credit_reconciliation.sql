begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create index if not exists runtime_model_requests_org_execution_idx on public.runtime_model_requests(organization_id,execution_id);
create index if not exists usage_ledger_org_execution_idx on public.usage_ledger(organization_id,execution_id);
-- Extend existing accounting with proof validation and atomic administrator attribution.
create or replace function public.reconcile_flux_credit_capacity(
 p_organization_id uuid,p_reservation_id uuid,p_actor_email text,p_actor_user_id uuid,p_reason text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare execution uuid; r public.flux_credit_reservations; m public.runtime_model_requests; n integer;
 result jsonb; outcome text:='blocked'; code text:='evidence_incomplete';
begin
 if p_actor_email is null or length(btrim(p_actor_email)) not between 3 and 254
   or p_reason is null or length(btrim(p_reason)) not between 15 and 500 then raise exception 'Administrator identity and review reason required'; end if;
 perform 1 from public.organizations where id=p_organization_id for share;
 perform 1 from public.flux_credit_wallets where organization_id=p_organization_id for update;
 select * into r from public.flux_credit_reservations where id=p_reservation_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Reservation not found inside organization'; end if;
 if r.status='settled' then outcome:='already_settled';code:='already_settled';
 elsif r.status='released' then code:='reservation_released';
 elsif not exists(select 1 from public.organizations where id=p_organization_id and status='active') then code:='organization_inactive';
 elsif r.source<>'phase12_provider_runtime' or r.action_key<>'web_ai' or r.reserved_credits<>2 or r.idempotency_key !~* '^phase12-provider:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then code:='unsupported_unit';
 else
   execution:=substr(r.idempotency_key,length('phase12-provider:')+1)::uuid;
   select count(*) into n from public.runtime_model_requests
    where organization_id=p_organization_id and execution_id=execution;
   if n=1 then
     select * into m from public.runtime_model_requests where organization_id=p_organization_id and execution_id=execution for share;
     if m.status='succeeded' and m.completed_at>=r.created_at
       and m.response_payload->>'credit_reservation_id'=r.id::text
       and m.response_payload->>'credit_request_fingerprint'=r.request_fingerprint
       and jsonb_typeof(m.response_payload->'output_text')='string'
       and length(coalesce(m.response_payload->>'provider',''))>0
       and length(coalesce(m.response_payload->>'id',''))>0
       and jsonb_typeof(m.response_payload->'credit_provider_cost_cents')='number'
       and m.response_payload->'credit_provider_cost_cents'='1'::jsonb
       and (r.metadata->>'provider_response_id' is null or r.metadata->>'provider_response_id'=m.response_payload->>'id') then
       perform 1 from public.usage_ledger where organization_id=p_organization_id and execution_id=m.execution_id and metadata->>'credit_reservation_id'=r.id::text for share;
       select count(*) into n from public.usage_ledger where organization_id=p_organization_id and execution_id=m.execution_id
         and usage_type='ai_tokens' and metadata->>'credit_reservation_id'=r.id::text
         and metadata->>'credit_request_fingerprint'=r.request_fingerprint
         and metadata->>'provider_response_id'=m.response_payload->>'id'
         and metadata->>'provider'=m.response_payload->>'provider'
         and quantity>=0 and to_jsonb(quantity)=m.response_payload->'credit_usage_quantity' and occurred_at>=r.created_at;
       if n=1 and (select count(*) from public.usage_ledger where organization_id=p_organization_id and execution_id=m.execution_id and usage_type='ai_tokens')=1 then
         perform 1 from public.runtime_progress_events where organization_id=p_organization_id and execution_id=m.execution_id and payload->>'credit_reservation_id'=r.id::text for share;
         select count(*) into n from public.runtime_progress_events where organization_id=p_organization_id and execution_id=m.execution_id
           and event_type='provider.completed' and payload->>'credit_reservation_id'=r.id::text
           and payload->>'credit_request_fingerprint'=r.request_fingerprint
           and payload->>'provider_response_id'=m.response_payload->>'id'
           and payload->>'provider'=m.response_payload->>'provider' and created_at>=r.created_at;
         if n=1 and (select count(*) from public.runtime_progress_events where organization_id=p_organization_id and execution_id=m.execution_id and event_type='provider.completed')=1 then
           result:=public.finish_flux_credit_capacity(p_organization_id,r.id,'settled','admin_reconciliation',m.response_payload->>'provider',1,
             jsonb_build_object('inputTokens',m.response_payload#>'{usage,input_tokens}','outputTokens',m.response_payload#>'{usage,output_tokens}','totalTokens',m.response_payload#>'{usage,total_tokens}'),
             jsonb_build_object('actor_email',btrim(p_actor_email),'actor_user_id',p_actor_user_id,'reconciliation_reason',btrim(p_reason),
               'execution_id',m.execution_id,'provider_response_id',m.response_payload->>'id','recovery',true));
           outcome:=result->>'status';code:=case when outcome='settled' then 'settled' else 'accounting_needs_attention' end;
           r.status:=outcome;
         end if;
       end if;
     end if;
   end if;
 end if;
 -- Audit failure rolls settlement, ledger debit and reservation history back together.
 insert into public.audit_logs(organization_id,actor_user_id,action,resource_type,resource_id,reason,metadata)
 values(p_organization_id,p_actor_user_id,'billing.credit_reservation.reconcile','flux_credit_reservation',r.id::text,btrim(p_reason),
   jsonb_build_object('actor_email',btrim(p_actor_email),'outcome',outcome,'code',code,'status',r.status,'credits',r.reserved_credits));
 return jsonb_build_object('id',r.id,'organization_id',p_organization_id,'status',r.status,'outcome',outcome,'code',code);
end;
$$;
revoke all on function public.reconcile_flux_credit_capacity(uuid,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.reconcile_flux_credit_capacity(uuid,uuid,text,uuid,text) to service_role;
commit;
