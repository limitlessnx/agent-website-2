update public.agents a
set human_handoff_destination =
  jsonb_set(
    a.human_handoff_destination - 'delivery_route',
    '{delivery_route}',
    to_jsonb('sendWhatsAppMessage'::text)
  )
from public.organizations o
where a.organization_id = o.id
  and o.slug = 'limitless-realty'
  and a.slug = 'maia';
