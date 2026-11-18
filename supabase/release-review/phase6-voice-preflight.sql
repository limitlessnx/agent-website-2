-- Read-only metadata preflight. No provider calls, customer rows or credentials.
-- Run before reviewing a release; this script does not install anything.
select jsonb_build_object(
  'voice_calls_present', to_regclass('public.elevenlabs_voice_calls') is not null,
  'voice_receipts_present', to_regclass('public.elevenlabs_voice_webhook_events') is not null,
  'recovery_rpc_present', to_regprocedure('public.apply_elevenlabs_voice_receipt(text,jsonb,uuid,uuid,text,text,jsonb,integer,text,numeric)') is not null,
  'required_tables_present', (select bool_and(to_regclass('public.'||t) is not null)
    from unnest(array['organizations','agents','agent_conversations','handoff_requests','flux_credit_wallets','flux_credit_ledger']) t),
  'agent_tenant_unique_key', exists(select 1 from pg_constraint
    where conrelid='public.agents'::regclass and contype in ('p','u')
    and pg_get_constraintdef(oid)='UNIQUE (organization_id, id)'),
  'conversation_thread_unique_key', exists(select 1 from pg_constraint
    where conrelid='public.agent_conversations'::regclass and contype='u'
    and pg_get_constraintdef(oid)='UNIQUE (organization_id, channel, external_thread_key)'),
  'credit_rpc_body_md5', (select md5(prosrc) from pg_proc
    where oid=to_regprocedure('public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb)')),
  'credit_rpc_service_execute', has_function_privilege('service_role',
    'public.record_flux_credit_usage(uuid,text,integer,text,text,numeric,jsonb,jsonb)','EXECUTE'),
  'service_dependency_grants', (select jsonb_agg(jsonb_build_object('table',t,
    'select',has_table_privilege('service_role','public.'||t,'SELECT'),
    'insert',has_table_privilege('service_role','public.'||t,'INSERT'),
    'update',has_table_privilege('service_role','public.'||t,'UPDATE')))
    from unnest(array['agents','agent_conversations','handoff_requests','flux_credit_wallets']) t),
  'configured_provider_mappings', (select count(*) from public.agents
    where nullif(configuration->>'elevenlabs_agent_id','') is not null),
  'reviewed_migration_records', (select coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name)),'[]')
    from supabase_migrations.schema_migrations
    where version in ('20261012090000','20261118163533','20261118091000'))
) as phase6_preflight;
