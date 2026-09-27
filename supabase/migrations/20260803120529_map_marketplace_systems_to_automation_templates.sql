create table if not exists public.system_automation_templates (
  id uuid primary key default gen_random_uuid(),
  system_id uuid not null references public.system_catalog(id) on delete cascade,
  automation_template_id uuid not null references public.automation_templates(id) on delete cascade,
  required boolean not null default true,
  display_order integer not null default 0,
  configuration_overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(system_id, automation_template_id)
);

alter table public.system_automation_templates enable row level security;

insert into public.system_automation_templates(system_id, automation_template_id, required, display_order)
select s.id, a.id, true, m.ord
from (values
  ('whatsapp-agent','lead-intake-router',1),
  ('whatsapp-agent','lead-qualification',2),
  ('whatsapp-agent','whatsapp-lead-follow-up',3),
  ('email-automation','email-outreach',1),
  ('lead-generation-system','lead-intake-router',1),
  ('lead-generation-system','lead-qualification',2),
  ('support-agent','customer-support-handoff',1),
  ('onboarding-agent','lead-intake-router',1),
  ('appointment-system','appointment-reminders',1),
  ('follow-up-system','whatsapp-lead-follow-up',1),
  ('enterprise-system','lead-intake-router',1),
  ('enterprise-system','lead-qualification',2),
  ('enterprise-system','whatsapp-lead-follow-up',3),
  ('enterprise-system','email-outreach',4),
  ('enterprise-system','appointment-reminders',5),
  ('enterprise-system','customer-support-handoff',6),
  ('enterprise-system-2','lead-intake-router',1),
  ('enterprise-system-2','lead-qualification',2),
  ('enterprise-system-2','email-outreach',3),
  ('enterprise-system-2','customer-support-handoff',4)
) as m(system_slug, automation_slug, ord)
join public.system_catalog s on s.slug = m.system_slug
join public.automation_templates a on a.slug = m.automation_slug
on conflict(system_id, automation_template_id)
do update set required = excluded.required, display_order = excluded.display_order;

create index if not exists system_automation_templates_system_idx
  on public.system_automation_templates(system_id, display_order);
