create extension if not exists pgcrypto;

create table if not exists public.system_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null,
  description text,
  category text not null check (category in ('core','addon','enterprise')),
  status text not null default 'available' check (status in ('draft','available','coming_soon','hidden','retired')),
  featured boolean not null default false,
  capabilities jsonb not null default '[]'::jsonb,
  included_agents jsonb not null default '[]'::jsonb,
  setup_requirements jsonb not null default '[]'::jsonb,
  display_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_systems (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  system_id uuid not null references public.system_catalog(id) on delete restrict,
  status text not null default 'setup_required' check (status in ('setup_required','awaiting_approval','provisioning','testing','active','paused','needs_attention','archived')),
  configuration jsonb not null default '{}'::jsonb,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  activated_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, system_id)
);

create index if not exists system_catalog_category_status_idx on public.system_catalog(category,status,display_order);
create index if not exists organization_systems_org_status_idx on public.organization_systems(organization_id,status,updated_at desc);

insert into public.system_catalog (slug,name,summary,description,category,status,featured,capabilities,included_agents,setup_requirements,display_order)
values
('whatsapp-agent','WhatsApp Agent','Qualify leads, answer enquiries and continue conversations on WhatsApp.','A client-facing WhatsApp system with business knowledge, lead qualification, follow-up and human escalation.','core','available',true,'["Lead qualification","Business Q&A","Human handoff","Follow-up support"]','["WhatsApp Agent"]','["Business information","WhatsApp number","Business rules","FAQs"]',10),
('email-automation','Email Automation','Run structured email outreach, follow-ups and customer communication.','An email automation system for campaigns, nurture sequences, operational notifications and reporting.','core','available',false,'["Email campaigns","Nurture sequences","Operational messages","Delivery reporting"]','["Email Automation Agent"]','["Sending domain","Sender identity","Audience rules","Email content"]',20),
('outbound-call-agent','Outbound Call Agent','Call leads, qualify interest and route qualified conversations to staff.','A dedicated outbound calling system with scripts, qualification logic, calling windows and human handoff.','core','available',false,'["Outbound calls","Lead qualification","Call summaries","Human handoff"]','["Outbound Call Agent"]','["Calling script","Calling hours","Handoff number","Lead source"]',30),
('lead-generation','Lead Generation System','Find, enrich and organize prospects for outbound activity.','A lead generation system for prospect discovery, qualification and organized delivery into the client workspace.','core','available',false,'["Prospect discovery","Lead enrichment","Qualification","Lead delivery"]','["Lead Generation Agent"]','["Target audience","Locations","Industries","Qualification rules"]',40),
('support-agent','Support Agent','Answer customer questions and escalate issues to the right team.','A support system trained on company rules, FAQs, products and escalation policies.','core','available',false,'["Customer support","Knowledge answers","Ticket classification","Escalation"]','["Support Agent"]','["FAQs","Business rules","Products and services","Escalation contacts"]',50),
('onboarding-agent','Onboarding Agent','Guide new customers through setup, documents and next steps.','A structured onboarding system that collects information, explains requirements and monitors completion.','core','available',false,'["Customer onboarding","Document requests","Progress tracking","Reminders"]','["Onboarding Agent"]','["Onboarding steps","Required documents","Completion rules","Escalation contacts"]',60),
('appointment-system','Appointment System','Book, confirm and remind customers about appointments.','An add-on for booking, rescheduling, confirmations and reminders across supported channels.','addon','available',false,'["Booking","Rescheduling","Confirmations","Reminders"]','[]','["Availability","Appointment types","Reminder timing"]',100),
('follow-up-system','Follow-up System','Create editable multi-step follow-up sequences for leads and customers.','An add-on for scheduled follow-ups with configurable timing, channels and stop conditions.','addon','available',false,'["Editable sequences","Scheduled reminders","Pause and resume","Reply stop rules"]','[]','["Sequence timing","Messages","Audience rules","Escalation policy"]',110),
('telegram-system','Telegram System','Send operational alerts and controlled team notifications through Telegram.','An add-on for internal alerts, summaries and selected customer communication.','addon','available',false,'["Team alerts","Operational summaries","Escalation notifications"]','[]','["Telegram destination","Notification rules"]',120),
('enterprise-system','Enterprise System','A multi-channel business operating system based on the Limitless Realty V2 model.','Includes WhatsApp, inbound and outbound calling, email automation, follow-ups, appointments, Telegram, CRM and reporting.','enterprise','available',true,'["WhatsApp","Inbound calls","Outbound calls","Email automation","Follow-ups","Appointments","Telegram","CRM and reporting"]','["Primary Business Agent","Inbound Call Agent","Outbound Call Agent","Email Automation Agent"]','["Complete business knowledge","Channel credentials","Team and escalation rules","Operating hours"]',200),
('enterprise-system-2','Enterprise System 2','A digital growth and customer operations system based on the Gencouv model.','Includes a website, lead generation, email automation, customer support, onboarding and reporting.','enterprise','available',true,'["Website","Lead generation","Email automation","Customer support","Customer onboarding","Reporting"]','["Lead Generation Agent","Support Agent","Onboarding Agent"]','["Website content","Target audience","Support knowledge","Onboarding process"]',210)
on conflict (slug) do update set
  name=excluded.name,
  summary=excluded.summary,
  description=excluded.description,
  category=excluded.category,
  status=excluded.status,
  featured=excluded.featured,
  capabilities=excluded.capabilities,
  included_agents=excluded.included_agents,
  setup_requirements=excluded.setup_requirements,
  display_order=excluded.display_order,
  updated_at=now();

alter table public.system_catalog enable row level security;
alter table public.organization_systems enable row level security;

comment on table public.system_catalog is 'Business-facing Fluxknight systems available in the client marketplace.';
comment on table public.organization_systems is 'Tenant-scoped system selections and installations. Backend workflow details remain private.';