begin;

-- The original check omitted provider-confirmed terminal states even though the
-- signed callback handler records them. Keep the shared status vocabulary exact.
alter table public.handoff_notifications
  drop constraint if exists handoff_notifications_status_check;
alter table public.handoff_notifications
  add constraint handoff_notifications_status_check
  check (status in ('pending','sent','delivered','read','failed','skipped'));

-- Provider callbacks can be duplicated or arrive out of order. Serialize by
-- notification row and allow only forward transitions. Ambiguous provider IDs
-- are deliberately not updated.
create or replace function public.apply_handoff_notification_receipt(
  p_organization_id uuid,
  p_provider_message_id text,
  p_status text,
  p_error_message text default null,
  p_error_code text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_notification public.handoff_notifications%rowtype;
  v_matches integer;
  v_next_status text;
  v_applied boolean := false;
begin
  p_status := lower(coalesce(trim(p_status),''));
  if p_status not in ('sent','delivered','read','failed') then
    raise exception 'Unsupported handoff delivery status';
  end if;
  if coalesce(trim(p_provider_message_id),'') = '' then
    return jsonb_build_object('applied',false,'status','unmatched');
  end if;

  select count(*) into v_matches
  from public.handoff_notifications
  where organization_id = p_organization_id
    and provider_message_id = p_provider_message_id;
  if v_matches = 0 then
    return jsonb_build_object('applied',false,'status','unmatched');
  elsif v_matches > 1 then
    return jsonb_build_object('applied',false,'status','ambiguous');
  end if;

  select * into v_notification
  from public.handoff_notifications
  where organization_id = p_organization_id
    and provider_message_id = p_provider_message_id
  for update;
  if not found then
    return jsonb_build_object('applied',false,'status','unmatched');
  end if;

  if v_notification.status = 'delivered' and p_status = 'read' then
    v_next_status := 'read';
  elsif v_notification.status in ('pending','sent','failed') and p_status in ('delivered','read') then
    v_next_status := p_status;
  elsif v_notification.status in ('pending','sent') and p_status = 'failed' then
    v_next_status := 'failed';
  elsif v_notification.status = 'pending' and p_status = 'sent' then
    v_next_status := 'sent';
  else
    v_next_status := null;
  end if;

  if v_next_status is not null then
    update public.handoff_notifications
    set status = v_next_status,
        error_message = case when v_next_status = 'failed'
          then left(coalesce(nullif(trim(p_error_message),''),'WhatsApp delivery failed.'),2000)
          else null end,
        error_code = case when v_next_status = 'failed'
          then left(nullif(regexp_replace(coalesce(trim(p_error_code),''),'[^A-Za-z0-9_-]','','g'),''),64)
          else null end
    where id = v_notification.id
    returning * into v_notification;
    v_applied := true;
  end if;

  return jsonb_build_object(
    'applied',v_applied,
    'status',v_notification.status,
    'notificationId',v_notification.id,
    'organizationId',v_notification.organization_id,
    'handoffId',v_notification.handoff_id,
    'recipient',v_notification.recipient,
    'metadata',v_notification.metadata,
    'errorMessage',v_notification.error_message
  );
end;
$$;

revoke all on function public.apply_handoff_notification_receipt(uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.apply_handoff_notification_receipt(uuid,text,text,text,text)
  to service_role;

commit;
