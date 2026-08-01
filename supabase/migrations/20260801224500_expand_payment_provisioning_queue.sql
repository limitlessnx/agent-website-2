begin;

create or replace function private.queue_paid_quote_provisioning(target_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payment_attempts%rowtype;
  selection record;
begin
  select * into payment from public.payment_attempts where id = target_payment_id for update;
  if payment.id is null or payment.status <> 'paid' then raise exception 'Payment is not paid'; end if;

  update public.organization_quotes set status = 'paid', updated_at = now()
  where id = payment.quote_id and organization_id = payment.organization_id;

  insert into public.provisioning_jobs (organization_id, payment_attempt_id, job_type, payload)
  values
    (payment.organization_id, payment.id, 'activate_subscription', jsonb_build_object('quote_id', payment.quote_id)),
    (payment.organization_id, payment.id, 'create_crm_defaults', jsonb_build_object('quote_id', payment.quote_id)),
    (payment.organization_id, payment.id, 'create_channel_placeholders', jsonb_build_object('quote_id', payment.quote_id))
  on conflict do nothing;

  for selection in
    select id from public.organization_agent_selections
    where organization_id = payment.organization_id and status in ('selected','configured','quoted','payment_pending','paid')
  loop
    update public.organization_agent_selections set status = 'paid', updated_at = now() where id = selection.id;
    insert into public.provisioning_jobs (organization_id, payment_attempt_id, agent_selection_id, job_type)
    values (payment.organization_id, payment.id, selection.id, 'provision_agent')
    on conflict do nothing;
  end loop;
end;
$$;

revoke all on function private.queue_paid_quote_provisioning(uuid) from public, anon, authenticated;

commit;
