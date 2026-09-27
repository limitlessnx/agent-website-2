create unique index if not exists crm_tasks_follow_up_sequence_child_unique
on public.crm_tasks (
  organization_id,
  customer_id,
  ((metadata->>'previous_task_id')),
  ((metadata->>'sequence_step'))
)
where task_type = 'sales_follow_up'
  and coalesce(metadata->>'previous_task_id','') <> '';
