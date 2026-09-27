create unique index if not exists agent_runtime_sessions_active_external_unique
  on public.agent_runtime_sessions (organization_id, agent_id, channel, external_conversation_id)
  where status = 'active' and external_conversation_id is not null;
