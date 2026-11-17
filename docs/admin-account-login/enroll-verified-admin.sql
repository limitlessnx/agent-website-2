-- Run only as part of an explicitly approved operator enrollment.
-- Within the same transaction, set this transaction-local parameter first:
-- select set_config('fluxknight.admin_enrollment_email','approved-account@example.test',true);
do $$
declare
  target_email text := nullif(trim(current_setting('fluxknight.admin_enrollment_email', true)), '');
  target_id uuid;
begin
  if target_email is null then raise exception 'An explicitly approved account email is required'; end if;
  select id into strict target_id from auth.users
    where lower(email) = lower(target_email) and email_confirmed_at is not null;
  if exists(select 1 from public.platform_super_admins where user_id=target_id and status<>'active') then
    raise exception 'Disabled administrator access requires a separate review';
  end if;
  insert into public.platform_super_admins(user_id,status) values(target_id,'active')
    on conflict(user_id) do nothing;
end;
$$;
