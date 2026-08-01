begin;

create table if not exists public.provisioning_artifacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provisioning_job_id uuid not null references public.provisioning_jobs(id) on delete cascade,
  agent_selection_id uuid references public.organization_agent_selections(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('subscription','agent_family','project','agent','knowledge_collection','integration','channel_binding','crm_defaults')),
  artifact_id uuid,
  artifact_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provisioning_job_id, artifact_type, artifact_key)
);

alter table public.provisioning_artifacts enable row level security;
create policy "members_view_provisioning_artifacts" on public.provisioning_artifacts
for select to authenticated using (public.is_organization_member(organization_id));

create unique index if not exists provisioning_jobs_unique_agent_job
on public.provisioning_jobs(organization_id, payment_attempt_id, agent_selection_id, job_type)
where agent_selection_id is not null;

create unique index if not exists provisioning_jobs_unique_org_job
on public.provisioning_jobs(organization_id, payment_attempt_id, job_type)
where agent_selection_id is null;

create or replace function public.process_next_provisioning_job()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.provisioning_jobs%rowtype;
  selection public.organization_agent_selections%rowtype;
  org public.organizations%rowtype;
  family_id uuid;
  project_id uuid;
  agent_id uuid;
  knowledge_id uuid;
  integration_id uuid;
  channel_name text;
  channel_list jsonb;
  slug_base text;
  result jsonb := '{}'::jsonb;
begin
  select * into job
  from public.provisioning_jobs
  where status in ('queued','failed')
    and attempts < max_attempts
    and available_at <= now()
  order by created_at
  for update skip locked
  limit 1;

  if job.id is null then
    return jsonb_build_object('processed', false, 'reason', 'no_job');
  end if;

  update public.provisioning_jobs
  set status = 'running', attempts = attempts + 1, started_at = now(), updated_at = now(), last_error = null
  where id = job.id;

  begin
    select * into org from public.organizations where id = job.organization_id;
    if org.id is null then raise exception 'Organization not found'; end if;

    if job.job_type = 'activate_subscription' then
      insert into public.provisioning_artifacts (organization_id, provisioning_job_id, artifact_type, artifact_key, metadata)
      values (job.organization_id, job.id, 'subscription', 'payment_activation', jsonb_build_object('payment_attempt_id', job.payment_attempt_id))
      on conflict do nothing;

      insert into public.organization_entitlements (organization_id, feature_key, enabled, source, configuration)
      values (job.organization_id, 'platform_access', true, 'admin', jsonb_build_object('payment_attempt_id', job.payment_attempt_id))
      on conflict do nothing;

      result := jsonb_build_object('subscription_activated', true);

    elsif job.job_type = 'create_crm_defaults' then
      insert into public.provisioning_artifacts (organization_id, provisioning_job_id, artifact_type, artifact_key, metadata)
      values (job.organization_id, job.id, 'crm_defaults', 'universal_crm', jsonb_build_object('tables', jsonb_build_array('crm_customers','crm_leads','crm_conversations','crm_messages','crm_tasks')))
      on conflict do nothing;
      result := jsonb_build_object('crm_ready', true);

    elsif job.job_type = 'create_channel_placeholders' then
      result := jsonb_build_object('channel_placeholders_ready', true);

    elsif job.job_type = 'provision_agent' then
      select * into selection from public.organization_agent_selections
      where id = job.agent_selection_id and organization_id = job.organization_id;
      if selection.id is null then raise exception 'Agent selection not found'; end if;

      slug_base := regexp_replace(lower(selection.agent_key), '[^a-z0-9]+', '-', 'g');

      select artifact_id into family_id from public.provisioning_artifacts
      where provisioning_job_id = job.id and artifact_type = 'agent_family' and artifact_key = selection.agent_key;
      if family_id is null then
        insert into public.agent_families (organization_id, template_id, name, slug, description, status, configuration)
        values (job.organization_id, selection.agent_template_id, selection.display_name, slug_base || '-' || substr(job.organization_id::text,1,8), 'Provisioned from paid agent selection', 'draft', selection.configuration)
        returning id into family_id;
        insert into public.provisioning_artifacts (organization_id, provisioning_job_id, agent_selection_id, artifact_type, artifact_id, artifact_key)
        values (job.organization_id, job.id, selection.id, 'agent_family', family_id, selection.agent_key);
      end if;

      select artifact_id into project_id from public.provisioning_artifacts
      where provisioning_job_id = job.id and artifact_type = 'project' and artifact_key = selection.agent_key;
      if project_id is null then
        insert into public.projects (organization_id, agent_family_id, name, slug, description, status, metadata)
        values (job.organization_id, family_id, selection.display_name || ' Project', slug_base || '-project-' || substr(job.organization_id::text,1,8), 'Managed agent project', 'draft', jsonb_build_object('selection_id', selection.id))
        returning id into project_id;
        insert into public.provisioning_artifacts (organization_id, provisioning_job_id, agent_selection_id, artifact_type, artifact_id, artifact_key)
        values (job.organization_id, job.id, selection.id, 'project', project_id, selection.agent_key);
      end if;

      channel_list := coalesce(selection.configuration->'channels', '[]'::jsonb);
      select artifact_id into agent_id from public.provisioning_artifacts
      where provisioning_job_id = job.id and artifact_type = 'agent' and artifact_key = selection.agent_key;
      if agent_id is null then
        insert into public.agents (organization_id, agent_family_id, project_id, name, slug, description, system_prompt, status, configuration, agent_type, communication_channels)
        values (job.organization_id, family_id, project_id, selection.display_name, slug_base || '-' || substr(job.organization_id::text,1,8), 'Provisioned agent awaiting configuration and testing', null, 'draft', selection.configuration, selection.agent_key, channel_list)
        returning id into agent_id;
        insert into public.provisioning_artifacts (organization_id, provisioning_job_id, agent_selection_id, artifact_type, artifact_id, artifact_key)
        values (job.organization_id, job.id, selection.id, 'agent', agent_id, selection.agent_key);
      end if;

      select artifact_id into knowledge_id from public.provisioning_artifacts
      where provisioning_job_id = job.id and artifact_type = 'knowledge_collection' and artifact_key = selection.agent_key;
      if knowledge_id is null then
        insert into public.knowledge_collections (organization_id, name, slug, description, status, metadata)
        values (job.organization_id, selection.display_name || ' Knowledge', slug_base || '-knowledge-' || substr(job.organization_id::text,1,8), 'Private knowledge collection for this agent', 'draft', jsonb_build_object('agent_id', agent_id))
        returning id into knowledge_id;
        insert into public.provisioning_artifacts (organization_id, provisioning_job_id, agent_selection_id, artifact_type, artifact_id, artifact_key)
        values (job.organization_id, job.id, selection.id, 'knowledge_collection', knowledge_id, selection.agent_key);
      end if;

      for channel_name in select jsonb_array_elements_text(channel_list)
      loop
        select id into integration_id from public.organization_integrations
        where organization_id = job.organization_id and provider = channel_name
        order by created_at limit 1;
        if integration_id is null then
          insert into public.organization_integrations (organization_id, provider, display_name, status, configuration)
          values (job.organization_id, channel_name, initcap(channel_name) || ' connection', 'disconnected', jsonb_build_object('required_by_agent_id', agent_id))
          returning id into integration_id;
        end if;
        insert into public.provisioning_artifacts (organization_id, provisioning_job_id, agent_selection_id, artifact_type, artifact_id, artifact_key, metadata)
        values (job.organization_id, job.id, selection.id, 'integration', integration_id, channel_name, jsonb_build_object('agent_id', agent_id))
        on conflict do nothing;
      end loop;

      update public.organization_agent_selections
      set status = 'provisioning', updated_at = now(), configuration = configuration || jsonb_build_object('provisioned_agent_id', agent_id, 'knowledge_collection_id', knowledge_id)
      where id = selection.id;

      result := jsonb_build_object('agent_id', agent_id, 'agent_family_id', family_id, 'project_id', project_id, 'knowledge_collection_id', knowledge_id);
    else
      raise exception 'Unsupported provisioning job type: %', job.job_type;
    end if;

    update public.provisioning_jobs set status = 'completed', completed_at = now(), updated_at = now(), payload = payload || jsonb_build_object('result', result) where id = job.id;
    return jsonb_build_object('processed', true, 'job_id', job.id, 'job_type', job.job_type, 'result', result);
  exception when others then
    update public.provisioning_jobs
    set status = case when attempts + 1 >= max_attempts then 'failed' else 'queued' end,
        last_error = sqlerrm,
        available_at = now() + make_interval(mins => least(60, power(2, attempts + 1)::int)),
        updated_at = now()
    where id = job.id;
    return jsonb_build_object('processed', false, 'job_id', job.id, 'error', sqlerrm);
  end;
end;
$$;

revoke all on function public.process_next_provisioning_job() from public, anon, authenticated;
grant execute on function public.process_next_provisioning_job() to service_role;

commit;
