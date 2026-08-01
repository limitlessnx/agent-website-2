alter table public.agent_approval_requests
  add constraint agent_approval_requests_org_id_unique
  unique (organization_id, id);