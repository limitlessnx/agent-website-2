create or replace function public.gencouv_bind_brevo_receipt(p_batch_id uuid,p_message_id uuid,p_email text,p_provider_id text)
returns boolean language plpgsql security invoker set search_path=public as $$
declare v_org constant uuid:='05737e03-f8f0-4202-8e9b-0a8982a1091c';
begin
  if p_provider_id is null or length(p_provider_id) not between 1 and 512 then return false; end if;
  perform 1 from public.gencouv_send_batches where id=p_batch_id and organization_id=v_org and provider='brevo' and status in ('submitting','unknown','partial','submitted') for update;
  if not found then return false; end if;
  update public.gencouv_email_messages set provider_email_id=p_provider_id,
    status=case when status in ('queued','unknown') then 'submitted' else status end,updated_at=now()
  where id=p_message_id and organization_id=v_org and send_batch_id=p_batch_id and direction='outbound' and provider='brevo'
    and lower(recipient_email)=lower(p_email) and (provider_email_id is null or provider_email_id=p_provider_id);
  return found;
end;
$$;
revoke all on function public.gencouv_bind_brevo_receipt(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.gencouv_bind_brevo_receipt(uuid,uuid,text,text) to service_role;
