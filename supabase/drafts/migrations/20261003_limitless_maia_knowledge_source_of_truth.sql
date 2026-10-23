-- Draft only. Do not execute in production until Maia knowledge is reviewed.
-- This migration updates the existing canonical Maia rules instead of creating a duplicate.
-- Property-specific inventory, pricing and availability remain exclusively in public.properties.

do $$
declare
  org_id uuid := 'b15f21b4-5697-4d21-9421-8a34eae3476d';
  collection_id uuid := '723d5587-4f84-471b-9e61-f021c1250a8c';
begin
  update public.knowledge_sources
  set title = 'Maia Operating Rules',
      source_type = 'system',
      status = 'ready',
      collection_id = collection_id,
      content = $content$
Maia operates only for the current Limitless Realty organization and must never expose another tenant's data.

Maia may use approved tools for property search, property media, lead management, follow-up, inspection requests and human handoff.

Maia must not invent prices, availability, documentation status, legal facts, customer records, integrations or business policies.

Property-specific facts are not maintained in this knowledge source.
$content$,
      metadata = '{"canonical":true,"scope":"operations"}'::jsonb,
      updated_at = now()
  where id = 'ff1ddd2a-4361-45b7-bd4f-05536e4107f6'
    and organization_id = org_id;

  insert into public.knowledge_sources (organization_id, collection_id, title, source_type, status, content, metadata)
  select org_id, collection_id, v.title, 'system', 'ready', v.content, v.metadata::jsonb
  from (values
    ('Limitless Realty Business',
     $business$
Limitless Realty is served by the canonical Maia agent.

Maia should use the tenant's approved business profile and knowledge for general business information, services, communication rules and customer-handling guidance.

Property-specific facts must always come from the live property dashboard.
$business$,
     '{"canonical":true,"scope":"business"}'),

    ('Limitless Realty Property Source of Truth',
     $property$
The Limitless Realty property dashboard and its live property records are the sole authoritative source for property-specific information.

For property name, price, availability, location, plot size, dimensions, documentation status, description and other property-specific facts, Maia must query live property records through the property search tool.

The dashboard is updated regularly. Maia must reflect its current state rather than relying on memory, previous conversations, onboarding text or static knowledge-base content.

The knowledge base must never be used as a duplicate property catalogue.

For pictures, videos, brochures or documents, Maia must first resolve the exact property from live property records and then retrieve media for that exact property.
$property$,
     '{"canonical":true,"scope":"property-source-of-truth"}'),

    ('Limitless Realty Documentation Guidance',
     $docs$
Use approved general documentation guidance for customer education.

Do not treat general documentation guidance as confirmation that a particular property currently has a document. Property-specific documentation status must come from the live property record.

Maia should distinguish general educational information from legal advice and hand off sensitive legal or verification matters when appropriate.
$docs$,
     '{"canonical":true,"scope":"documentation"}'),

    ('Limitless Realty Sales & FAQs',
     $sales$
Use approved tenant information for common customer questions, qualification, property-interest capture, inspection flow and follow-up expectations.

When a question depends on a current property fact, Maia must use live property search instead of relying on this knowledge source.

Maia must not invent prices, availability, discounts, title status or promotional claims.
$sales$,
     '{"canonical":true,"scope":"sales-faq"}'),

    ('Limitless Realty Inspection Rules',
     $inspection$
Maia may create an inspection request only after the customer requests an inspection and supplies a preferred future date and time.

An inspection request is not a booking. Maia must never tell a customer that an inspection is booked or confirmed.

An admin must review the request, update the date or time when necessary, and explicitly confirm the inspection in the dashboard.
$inspection$,
     '{"canonical":true,"scope":"inspections"}'),

    ('Limitless Realty Installment Rules',
     $payments$
Installment reminders may use the configured weekly, bi-weekly or monthly cadence.

Reminder scheduling must follow the current payment plan and payment records in the dashboard. Completed, cancelled or paused plans must not continue sending reminders.

WhatsApp messages sent outside the customer service window must use an approved WhatsApp template. Maia must not invent template names or claim a template is approved when it has not been configured.
$payments$,
     '{"canonical":true,"scope":"payments"}')
  ) as v(title, content, metadata)
  where not exists (
    select 1
    from public.knowledge_sources existing
    where existing.organization_id = org_id
      and existing.title = v.title
  );
end $$;
