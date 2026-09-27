create or replace function public.notify_fluxknight_provisioning_failed()
returns trigger
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare
  v_payment public.payment_attempts%rowtype;
  v_org_name text;
  v_email text;
  v_first_name text;
begin
  if new.status <> 'failed' or old.status is not distinct from new.status or new.payment_attempt_id is null then
    return new;
  end if;

  select * into v_payment from public.payment_attempts where id = new.payment_attempt_id;
  if v_payment.id is null then return new; end if;

  select name into v_org_name from public.organizations where id = v_payment.organization_id;

  if v_payment.created_by is not null then
    select email,
           coalesce(nullif(split_part(coalesce(raw_user_meta_data->>'full_name',''),' ',1),''),split_part(email,'@',1),'there')
      into v_email,v_first_name
      from auth.users
     where id = v_payment.created_by;
  end if;

  if v_email is null then return new; end if;

  perform public.dispatch_fluxknight_lifecycle_event(
    'provisioning-failed:' || v_payment.id::text,
    'fluxknight.provisioning.failed',
    v_email,
    jsonb_build_object(
      'first_name',v_first_name,
      'workspace_name',coalesce(v_org_name,'your Fluxknight workspace'),
      'reason','A workspace setup task could not be completed. Our team can review the setup without exposing your account to further changes.',
      'support_url','https://fluxknight.space/portal/support'
    ),
    v_payment.created_by,
    v_payment.organization_id,
    v_payment.id
  );

  return new;
end;
$$;

revoke all on function public.notify_fluxknight_provisioning_failed() from public, anon, authenticated;
