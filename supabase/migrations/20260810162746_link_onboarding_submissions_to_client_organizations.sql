create or replace function public.resolve_onboarding_submission_organization()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  if new.organization_id is not null or nullif(btrim(new.purchaser_email), '') is null then
    return new;
  end if;

  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(btrim(new.purchaser_email))
  order by u.created_at desc
  limit 1;

  if v_user_id is null then
    return new;
  end if;

  select om.organization_id into v_org_id
  from public.organization_memberships om
  where om.user_id = v_user_id
    and om.status = 'active'
  order by om.created_at asc
  limit 1;

  if v_org_id is not null then
    new.organization_id := v_org_id;
  end if;

  return new;
end;
$$;

drop trigger if exists client_onboarding_submission_resolve_org on public.client_onboarding_submissions;
create trigger client_onboarding_submission_resolve_org
before insert or update of purchaser_email, organization_id
on public.client_onboarding_submissions
for each row execute function public.resolve_onboarding_submission_organization();

create or replace function public.attach_existing_onboarding_submissions_after_membership()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  if new.status <> 'active' then
    return new;
  end if;

  select email into v_email from auth.users where id = new.user_id;
  if nullif(btrim(v_email), '') is null then
    return new;
  end if;

  update public.client_onboarding_submissions
  set organization_id = new.organization_id,
      updated_at = now()
  where organization_id is null
    and lower(purchaser_email) = lower(v_email);

  return new;
end;
$$;

drop trigger if exists organization_membership_attach_onboarding_submissions on public.organization_memberships;
create trigger organization_membership_attach_onboarding_submissions
after insert or update of status
on public.organization_memberships
for each row execute function public.attach_existing_onboarding_submissions_after_membership();
