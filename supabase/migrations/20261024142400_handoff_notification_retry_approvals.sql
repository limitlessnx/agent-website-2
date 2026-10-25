begin;

create table if not exists public.handoff_notification_retry_approvals (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  handoff_id uuid not null,
  notification_id uuid not null references public.handoff_notifications(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  actor_membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  message_digest text not null check (message_digest ~ '^[0-9a-f]{64}$'),
  recipient_digest text not null check (recipient_digest ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, handoff_id)
    references public.human_handoffs(organization_id, id) on delete cascade
);

create index if not exists handoff_notification_retry_approvals_expiry_idx
  on public.handoff_notification_retry_approvals (organization_id, expires_at);

alter table public.handoff_notification_retry_approvals enable row level security;
revoke all on public.handoff_notification_retry_approvals from public, anon, authenticated;
grant select, insert, update, delete on public.handoff_notification_retry_approvals to service_role;

create or replace function public.claim_real_estate_handoff_notification_retry(
  p_approval_id uuid,
  p_organization_id uuid,
  p_handoff_id uuid,
  p_notification_id uuid,
  p_actor_user_id uuid,
  p_actor_membership_id uuid,
  p_message_digest text,
  p_recipient_digest text,
  p_recipient text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_org public.organizations%rowtype;
  v_approval public.handoff_notification_retry_approvals%rowtype;
  v_handoff public.human_handoffs%rowtype;
  v_notification public.handoff_notifications%rowtype;
  v_industry text;
  v_retry_count integer;
begin
  select * into v_org from public.organizations where id = p_organization_id;
  v_industry := regexp_replace(lower(coalesce(v_org.metadata->>'industry_slug', v_org.metadata->>'industry', '')), '[^a-z]', '', 'g');
  if not found or v_org.status <> 'active' or not (v_org.slug = 'limitless-realty' or v_industry = 'realestate') then
    raise exception 'Retry is limited to active real-estate organizations' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_memberships
    where id = p_actor_membership_id
      and organization_id = p_organization_id
      and user_id = p_actor_user_id
      and status = 'active'
  ) then
    raise exception 'Retry actor is not an active member of this organization' using errcode = '42501';
  end if;

  select * into v_approval
  from public.handoff_notification_retry_approvals
  where id = p_approval_id
    and organization_id = p_organization_id
    and handoff_id = p_handoff_id
    and notification_id = p_notification_id
    and actor_user_id = p_actor_user_id
    and actor_membership_id = p_actor_membership_id
    and message_digest = p_message_digest
    and recipient_digest = p_recipient_digest
    and expires_at > now()
    and consumed_at is null
  for update;
  if not found then
    raise exception 'Retry approval expired, changed, or already used' using errcode = '42501';
  end if;

  select * into v_handoff from public.human_handoffs
  where organization_id = p_organization_id and id = p_handoff_id
  for update;
  if not found or v_handoff.status in ('resolved', 'closed') then
    raise exception 'Handoff is no longer open' using errcode = '55000';
  end if;

  select * into v_notification from public.handoff_notifications
  where organization_id = p_organization_id
    and handoff_id = p_handoff_id
    and id = p_notification_id
    and channel = 'whatsapp'
  for update;
  if not found or v_notification.status <> 'failed' or v_notification.error_code is null then
    raise exception 'Only a definitive provider rejection can be retried' using errcode = '55000';
  end if;
  if v_notification.retry_count >= 3 then
    raise exception 'Handoff notification retry limit reached' using errcode = '54000';
  end if;
  if coalesce(v_notification.recipient, '') = '' or v_notification.recipient <> p_recipient then
    raise exception 'Staff destination changed after preview' using errcode = '55000';
  end if;

  update public.handoff_notification_retry_approvals
  set consumed_at = now()
  where id = p_approval_id;

  v_retry_count := v_notification.retry_count + 1;
  update public.handoff_notifications
  set status = 'pending',
      error_message = null,
      error_code = null,
      provider_message_id = null,
      sent_at = null,
      retry_count = v_retry_count,
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{retry_history}',
        coalesce(metadata->'retry_history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'attempt', v_retry_count,
          'at', now(),
          'actor_membership_id', p_actor_membership_id,
          'approval_id', p_approval_id
        )),
        true
      )
  where id = p_notification_id and organization_id = p_organization_id;

  return jsonb_build_object(
    'claimed', true,
    'notificationId', p_notification_id,
    'retryCount', v_retry_count
  );
end;
$$;

revoke all on function public.claim_real_estate_handoff_notification_retry(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.claim_real_estate_handoff_notification_retry(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text)
  to service_role;

commit;
