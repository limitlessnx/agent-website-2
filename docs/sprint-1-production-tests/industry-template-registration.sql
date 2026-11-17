-- REVIEW REQUIRED: catalog configuration only. Not applied to production.
-- Reuse the existing template provisioner. Never clone an existing customer's assets.
begin;
insert into public.organization_templates
  (slug,name,industry,description,status,modules,agents,workflows,knowledge_structure,integration_requirements,metadata)
values
  ('photography-ai-suite','Photography Studio AI Suite','Photography Studio',
   'Draft studio workspace. Configure this business’s own catalog, booking rules, availability, capacity and handoffs before testing.',
   'active','["studio_catalog","bookings","availability","capacity","handoffs"]',
   '["studio_concierge","booking_assistant"]',
   '["studio_enquiry","booking_intake","capacity_review","customer_handoff"]',
   '["Business profile","Service packages","Booking and capacity policies","Human handoff rules"]',
   '["whatsapp","email","google_calendar"]',
   '{"industry_slug":"photography-studio","starter_version":1,"customer_content_included":false,"activation_required":true}'),
  ('hotel-ai-suite','Hotel AI Suite','Hotel',
   'Draft hospitality workspace. Configure this hotel’s own rooms, services, reservation policies, dining and escalation contacts before testing.',
   'active','["room_catalog","reservations","guest_services","dining","concierge","followups"]',
   '["hotel_concierge","reservation_assistant","guest_services"]',
   '["guest_enquiry","reservation_intake","guest_service_handoff","follow_up_review"]',
   '["Hotel information","Room and service catalog","Reservation and dining policies","Guest escalation rules"]',
   '["whatsapp","email","google_calendar"]',
   '{"industry_slug":"hotels","starter_version":1,"customer_content_included":false,"activation_required":true}')
on conflict (slug) do nothing;
do $check$
begin
  if not exists(select 1 from public.organization_templates where slug='photography-ai-suite' and industry='Photography Studio')
    or not exists(select 1 from public.organization_templates where slug='hotel-ai-suite' and industry='Hotel') then
    raise exception 'An existing starter slug conflicts with the reviewed industry. Review without overwriting it.';
  end if;
end $check$;
commit;
