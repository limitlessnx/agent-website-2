-- Tenant-scoped support agent isolation.
-- The application routes also filter by organization_id; these policies add database-level defense in depth.

create index if not exists support_conversations_org_updated_idx
  on public.support_conversations(organization_id, updated_at desc);

create index if not exists support_actions_org_status_idx
  on public.support_actions(organization_id, status, created_at desc);

drop policy if exists support_conversations_tenant_select on public.support_conversations;
drop policy if exists support_messages_tenant_select on public.support_messages;
drop policy if exists support_actions_tenant_select on public.support_actions;

create policy support_conversations_tenant_select
on public.support_conversations
for select
to authenticated
using (
  organization_id is not null
  and public.is_organization_member(organization_id)
);

create policy support_messages_tenant_select
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations sc
    where sc.id = support_messages.conversation_id
      and sc.organization_id is not null
      and public.is_organization_member(sc.organization_id)
  )
);

create policy support_actions_tenant_select
on public.support_actions
for select
to authenticated
using (
  organization_id is not null
  and public.is_organization_member(organization_id)
);

comment on table public.support_conversations is 'Agent Leo support conversations. Tenant cases must carry organization_id; super-admin platform cases may be global.';
