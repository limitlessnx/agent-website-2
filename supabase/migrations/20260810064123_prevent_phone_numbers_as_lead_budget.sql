create or replace function public.sanitize_lead_budget_phone_collision()
returns trigger
language plpgsql
as $$
declare
  budget_digits text;
  matches_known_phone boolean;
begin
  budget_digits := regexp_replace(coalesce(new.budget, ''), '[^0-9]', '', 'g');

  if budget_digits = '' then
    return new;
  end if;

  select exists (
    select 1
    from public.leads l
    where l.id is distinct from new.id
      and regexp_replace(coalesce(l.phone, ''), '[^0-9]', '', 'g') = budget_digits
      and length(budget_digits) >= 10
  ) into matches_known_phone;

  if regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g') = budget_digits
     or matches_known_phone
     or budget_digits ~ '^234[0-9]{10}$' then
    new.budget := '';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sanitize_lead_budget_phone_collision on public.leads;
create trigger trg_sanitize_lead_budget_phone_collision
before insert or update of budget, phone on public.leads
for each row
execute function public.sanitize_lead_budget_phone_collision();
