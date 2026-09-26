-- A4: tenant data isolation hardening
revoke execute on function public.claim_agent_runtime_goal(uuid,text) from public, anon, authenticated;
revoke execute on function public.claim_next_maia_autonomous_goal() from public, anon, authenticated;
revoke execute on function public.complete_client_onboarding(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.provision_selected_agent_allocations(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.provision_trial_client_organization(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.start_fluxknight_basic_free_trial(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_fluxknight_subscription_grace_expiry() from public, anon, authenticated;
revoke execute on function public.send_fluxknight_grace_period_warnings() from public, anon, authenticated;
revoke execute on function public.send_fluxknight_subscription_reminders() from public, anon, authenticated;
revoke execute on function public.attach_existing_onboarding_submissions_after_membership() from public, anon, authenticated;
revoke execute on function public.handle_client_signup_provisioning() from public, anon, authenticated;
revoke execute on function public.resolve_onboarding_submission_organization() from public, anon, authenticated;

revoke all on table
 public.agent_runtime_events,public.agent_runtime_goals,public.agent_runtime_messages,
 public.agent_runtime_sessions,public.agent_runtime_tool_runs,public.runtime_model_requests,
 public.runtime_tool_calls,public.automation_provisioning_jobs,public.organization_automations
from anon,authenticated;
grant all on table
 public.agent_runtime_events,public.agent_runtime_goals,public.agent_runtime_messages,
 public.agent_runtime_sessions,public.agent_runtime_tool_runs,public.runtime_model_requests,
 public.runtime_tool_calls,public.automation_provisioning_jobs,public.organization_automations
to service_role;

revoke all on table public.organization_entitlements,public.organization_systems from anon;
revoke all on table public.organization_entitlements,public.organization_systems from authenticated;
grant select on table public.organization_entitlements,public.organization_systems to authenticated;
grant all on table public.organization_entitlements,public.organization_systems to service_role;

drop policy if exists organization_systems_member_select on public.organization_systems;
create policy organization_systems_member_select on public.organization_systems
for select to authenticated
using (public.has_organization_permission(organization_id,'systems.view') or public.has_organization_permission(organization_id,'systems.manage'));

drop policy if exists organization_entitlements_member_select on public.organization_entitlements;
create policy organization_entitlements_member_select on public.organization_entitlements
for select to authenticated using (public.is_organization_member(organization_id));

drop policy if exists crm_customers_member_access on public.crm_customers;
create policy crm_customers_select on public.crm_customers for select to authenticated
using (public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy crm_customers_insert on public.crm_customers for insert to authenticated
with check (public.has_organization_permission(organization_id,'customers.manage'));
create policy crm_customers_update on public.crm_customers for update to authenticated
using (public.has_organization_permission(organization_id,'customers.manage'))
with check (public.has_organization_permission(organization_id,'customers.manage'));
create policy crm_customers_delete on public.crm_customers for delete to authenticated
using (public.has_organization_permission(organization_id,'customers.manage'));

drop policy if exists crm_leads_member_access on public.crm_leads;
create policy crm_leads_select on public.crm_leads for select to authenticated
using (public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy crm_leads_insert on public.crm_leads for insert to authenticated
with check (public.has_organization_permission(organization_id,'customers.manage'));
create policy crm_leads_update on public.crm_leads for update to authenticated
using (public.has_organization_permission(organization_id,'customers.manage'))
with check (public.has_organization_permission(organization_id,'customers.manage'));
create policy crm_leads_delete on public.crm_leads for delete to authenticated
using (public.has_organization_permission(organization_id,'customers.manage'));

drop policy if exists crm_conversations_member_access on public.crm_conversations;
create policy crm_conversations_select on public.crm_conversations for select to authenticated
using (public.has_organization_permission(organization_id,'conversations.view') or public.has_organization_permission(organization_id,'conversations.reply'));
create policy crm_conversations_insert on public.crm_conversations for insert to authenticated
with check (public.has_organization_permission(organization_id,'conversations.reply'));
create policy crm_conversations_update on public.crm_conversations for update to authenticated
using (public.has_organization_permission(organization_id,'conversations.reply'))
with check (public.has_organization_permission(organization_id,'conversations.reply'));
create policy crm_conversations_delete on public.crm_conversations for delete to authenticated
using (public.has_organization_permission(organization_id,'organization.manage'));

drop policy if exists crm_messages_member_access on public.crm_messages;
create policy crm_messages_select on public.crm_messages for select to authenticated
using (public.has_organization_permission(organization_id,'conversations.view') or public.has_organization_permission(organization_id,'conversations.reply'));
create policy crm_messages_insert on public.crm_messages for insert to authenticated
with check (public.has_organization_permission(organization_id,'conversations.reply'));
create policy crm_messages_update on public.crm_messages for update to authenticated
using (public.has_organization_permission(organization_id,'conversations.reply'))
with check (public.has_organization_permission(organization_id,'conversations.reply'));
create policy crm_messages_delete on public.crm_messages for delete to authenticated
using (public.has_organization_permission(organization_id,'organization.manage'));

drop policy if exists conversations_tenant on public.agent_conversations;
create policy agent_conversations_select on public.agent_conversations for select to authenticated
using (public.has_organization_permission(organization_id,'conversations.view') or public.has_organization_permission(organization_id,'conversations.reply'));
create policy agent_conversations_insert on public.agent_conversations for insert to authenticated
with check (public.has_organization_permission(organization_id,'conversations.reply'));
create policy agent_conversations_update on public.agent_conversations for update to authenticated
using (public.has_organization_permission(organization_id,'conversations.reply'))
with check (public.has_organization_permission(organization_id,'conversations.reply'));
create policy agent_conversations_delete on public.agent_conversations for delete to authenticated
using (public.has_organization_permission(organization_id,'organization.manage'));

drop policy if exists messages_tenant on public.conversation_messages;
create policy conversation_messages_select on public.conversation_messages for select to authenticated
using (public.has_organization_permission(organization_id,'conversations.view') or public.has_organization_permission(organization_id,'conversations.reply'));

drop policy if exists follow_ups_tenant_member_access on public.follow_ups;
create policy follow_ups_select on public.follow_ups for select to authenticated
using (public.has_organization_permission(organization_id,'customers.view') or public.has_organization_permission(organization_id,'customers.manage'));
create policy follow_ups_manage on public.follow_ups for all to authenticated
using (public.has_organization_permission(organization_id,'customers.manage'))
with check (public.has_organization_permission(organization_id,'customers.manage'));

drop policy if exists handoffs_tenant on public.handoff_requests;
create policy handoff_requests_select on public.handoff_requests for select to authenticated
using (public.has_organization_permission(organization_id,'conversations.view') or public.has_organization_permission(organization_id,'conversations.reply'));
create policy handoff_requests_manage on public.handoff_requests for all to authenticated
using (public.has_organization_permission(organization_id,'conversations.reply'))
with check (public.has_organization_permission(organization_id,'conversations.reply'));

alter table public.agent_runtime_sessions
 add constraint agent_runtime_sessions_organization_id_id_key unique (organization_id,id);
alter table public.agent_runtime_goals
 add constraint agent_runtime_goals_org_agent_fkey foreign key (organization_id,agent_id)
 references public.agents(organization_id,id) on delete cascade;
alter table public.agent_runtime_sessions
 add constraint agent_runtime_sessions_org_agent_fkey foreign key (organization_id,agent_id)
 references public.agents(organization_id,id) on delete cascade;
alter table public.agent_runtime_messages
 add constraint agent_runtime_messages_org_agent_fkey foreign key (organization_id,agent_id)
 references public.agents(organization_id,id) on delete cascade;
alter table public.agent_runtime_messages
 add constraint agent_runtime_messages_org_session_fkey foreign key (organization_id,session_id)
 references public.agent_runtime_sessions(organization_id,id) on delete cascade;
alter table public.agent_runtime_tool_runs
 add constraint agent_runtime_tool_runs_org_agent_fkey foreign key (organization_id,agent_id)
 references public.agents(organization_id,id) on delete cascade;
alter table public.agent_runtime_tool_runs
 add constraint agent_runtime_tool_runs_org_session_fkey foreign key (organization_id,session_id)
 references public.agent_runtime_sessions(organization_id,id) on delete set null;

create index if not exists agent_runtime_goals_org_agent_idx on public.agent_runtime_goals(organization_id,agent_id);
create index if not exists agent_runtime_sessions_org_agent_idx on public.agent_runtime_sessions(organization_id,agent_id);
create index if not exists agent_runtime_messages_org_agent_idx on public.agent_runtime_messages(organization_id,agent_id);
create index if not exists agent_runtime_messages_org_session_idx on public.agent_runtime_messages(organization_id,session_id);
create index if not exists agent_runtime_tool_runs_org_agent_idx on public.agent_runtime_tool_runs(organization_id,agent_id);
create index if not exists agent_runtime_tool_runs_org_session_idx on public.agent_runtime_tool_runs(organization_id,session_id);
