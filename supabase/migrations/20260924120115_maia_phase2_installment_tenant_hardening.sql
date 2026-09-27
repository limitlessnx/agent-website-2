update public.payment_plans
set organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
where organization_id is null;

alter table public.payment_plans
  alter column organization_id set not null;

alter table public.payment_records
  add column if not exists organization_id uuid;

alter table public.reminder_attempts
  add column if not exists organization_id uuid;

update public.payment_records pr
set organization_id = pp.organization_id
from public.payment_plans pp
where pr.organization_id is null
  and pr.payment_plan_id = pp.id;

update public.reminder_attempts ra
set organization_id = pp.organization_id
from public.payment_plans pp
where ra.organization_id is null
  and ra.payment_plan_id = pp.id;

alter table public.payment_records
  alter column organization_id set not null;

alter table public.reminder_attempts
  alter column organization_id set not null;

alter table public.payment_records
  add constraint payment_records_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

alter table public.reminder_attempts
  add constraint reminder_attempts_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete cascade;

create unique index if not exists payment_plans_org_id_unique
  on public.payment_plans (organization_id, id);

create unique index if not exists reminder_templates_org_id_unique
  on public.reminder_templates (organization_id, id);

alter table public.payment_records
  add constraint payment_records_tenant_plan_fkey
  foreign key (organization_id, payment_plan_id)
  references public.payment_plans (organization_id, id)
  on delete cascade;

alter table public.reminder_attempts
  add constraint reminder_attempts_tenant_plan_fkey
  foreign key (organization_id, payment_plan_id)
  references public.payment_plans (organization_id, id)
  on delete cascade;

alter table public.reminder_attempts
  add constraint reminder_attempts_tenant_template_fkey
  foreign key (organization_id, reminder_template_id)
  references public.reminder_templates (organization_id, id)
  on delete set null;

create index if not exists payment_plans_org_due_idx
  on public.payment_plans (organization_id, status, next_due_date)
  where reminders_enabled is true;

create index if not exists payment_records_org_plan_idx
  on public.payment_records (organization_id, payment_plan_id, payment_date desc);

create index if not exists reminder_attempts_org_schedule_idx
  on public.reminder_attempts (organization_id, status, scheduled_for);

drop policy if exists payment_plans_tenant_member_access on public.payment_plans;
create policy payment_plans_tenant_member_access
on public.payment_plans
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists payment_records_tenant_member_access on public.payment_records;
create policy payment_records_tenant_member_access
on public.payment_records
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists reminder_templates_tenant_member_access on public.reminder_templates;
create policy reminder_templates_tenant_member_access
on public.reminder_templates
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

drop policy if exists reminder_attempts_tenant_member_access on public.reminder_attempts;
create policy reminder_attempts_tenant_member_access
on public.reminder_attempts
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
