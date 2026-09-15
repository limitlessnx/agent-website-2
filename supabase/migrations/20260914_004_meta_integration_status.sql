alter table public.organization_integrations
  drop constraint if exists organization_integrations_status_check;

alter table public.organization_integrations
  add constraint organization_integrations_status_check
  check (status in ('disconnected','configured','connected','degraded','error','paused'));

comment on constraint organization_integrations_status_check on public.organization_integrations
is 'Allows the secure credential workflow to stage integrations as configured before a provider connection is verified.';
