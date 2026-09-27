create or replace function public.timeline_from_crm_task() returns trigger
language plpgsql security definer set search_path=''
as $$
begin
  if new.customer_id is not null then
    perform public.add_customer_timeline_event(
      new.organization_id,
      new.customer_id,
      'task.'||new.status,
      new.title,
      new.description,
      coalesce(new.metadata->>'channel','internal'),
      null,
      'crm_tasks',
      new.id,
      null,
      'system',
      coalesce(new.assigned_agent_id::text,null),
      jsonb_build_object(
        'task_type',new.task_type,
        'due_at',new.due_at,
        'completed_at',new.completed_at,
        'lead_id',new.lead_id
      ),
      new.updated_at
    );
  end if;
  return new;
end $$;

drop trigger if exists crm_task_customer_timeline on public.crm_tasks;
create trigger crm_task_customer_timeline
after insert or update of status,due_at,completed_at
on public.crm_tasks
for each row execute function public.timeline_from_crm_task();

grant select on public.customer_identity_conflicts to authenticated;

drop policy if exists customer_identity_conflicts_manage_select on public.customer_identity_conflicts;
create policy customer_identity_conflicts_manage_select
on public.customer_identity_conflicts
for select to authenticated
using(public.has_organization_permission(organization_id,'customers.manage'));
