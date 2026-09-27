alter table public.organization_ai_model_assignments drop constraint if exists organization_ai_model_assignments_pkey;
alter table public.organization_ai_model_assignments add primary key (organization_id, model_id);
create index if not exists organization_ai_model_assignments_org_idx on public.organization_ai_model_assignments (organization_id, assigned_at desc);
