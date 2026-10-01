update public.agents
set human_handoff_destination =
  jsonb_set(
    human_handoff_destination - 'delivery_route',
    '{delivery_route}',
    to_jsonb('sendWhatsAppMessage'::text)
  )
where organization_id = 'b15f21b4-5697-4d21-9421-8a34eae3476d'
  and slug = 'maia';
