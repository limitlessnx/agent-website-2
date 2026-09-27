do $$
declare
  v_org_id uuid;
  v_agent_id uuid;
begin
  select id into v_org_id from public.organizations where slug='limitless-realty' limit 1;
  if v_org_id is null then raise exception 'Limitless Realty organization not found'; end if;
  select id into v_agent_id from public.agents where organization_id=v_org_id and slug='maia' limit 1;
  if v_agent_id is null then raise exception 'Canonical Limitless Realty Maia not found'; end if;

  update public.agents
  set configuration = coalesce(configuration,'{}'::jsonb) || jsonb_build_object(
    'canonical_agent',true,
    'canonical_whatsapp_route','existing-limitless-realty-maia-n8n',
    'agentic_intelligence_route','/api/limitless/maia',
    'human_handoff_whatsapp','2348127753308',
    'do_not_create_secondary_maia',true
  ),
  communication_channels='["whatsapp","web","telegram","voice"]'::jsonb,
  human_handoff_destination=jsonb_build_object(
    'channel','whatsapp',
    'destination','2348127753308',
    'summary_before_handoff',true,
    'require_delivery_confirmation',true,
    'delivery_route','existing-limitless-realty-maia-n8n'
  )
  where id=v_agent_id;

  update public.projects
  set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'canonical_maia_agent_id',v_agent_id,
    'canonical_whatsapp_route','existing-limitless-realty-maia-n8n',
    'agentic_intelligence_route','/api/limitless/maia'
  )
  where id=(select project_id from public.agents where id=v_agent_id);
end $$;
