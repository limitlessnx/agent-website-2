create or replace function public.gencouv_promote_verified_raw_leads(
  p_organization_id uuid,
  p_requested_limit integer default 200
)
returns table(
  qualified_lead_id uuid,
  raw_lead_id uuid,
  normalized_email text,
  email text,
  full_name text
)
language sql
set search_path = public, pg_temp
as $function$
  with eligible as (
    select r.*
    from public.gencouv_raw_leads r
    where r.organization_id = p_organization_id
      and r.email is not null
      and btrim(r.email) <> ''
      and r.normalized_email is not null
      and btrim(r.normalized_email) <> ''
      and lower(r.normalized_email) !~ '@(example|test|invalid)\.'
      and lower(r.validation_status) in ('valid', 'verified', 'verified_mx')
      and lower(r.qualification_status) = 'qualified'
      and lower(r.campaign_status) = 'qualified'
      and not exists (
        select 1
        from public.gencouv_suppression_list sl
        where sl.organization_id = r.organization_id
          and sl.normalized_email = r.normalized_email
      )
      and not exists (
        select 1
        from public.gencouv_qualified_leads q
        where q.organization_id = r.organization_id
          and q.normalized_email = r.normalized_email
      )
    order by r.quality_score desc, r.created_at asc, r.id asc
    limit least(200, greatest(30, coalesce(p_requested_limit, 200)))
  ), inserted as (
    insert into public.gencouv_qualified_leads (
      organization_id,
      raw_lead_id,
      source,
      source_id,
      audience_id,
      audience_name,
      cohort_date,
      full_name,
      first_name,
      last_name,
      job_title,
      company,
      industry,
      location,
      country,
      email,
      normalized_email,
      phone,
      linkedin_url,
      website,
      product_interest,
      broker,
      quality_score,
      lifecycle_status,
      validation_status,
      qualification_status,
      campaign_status,
      email_sequence_status,
      current_sequence_step,
      reply_status,
      suppression_status,
      unsubscribe_status,
      do_not_contact,
      metadata
    )
    select
      e.organization_id,
      e.id,
      e.source,
      e.source_id,
      e.audience_id,
      e.audience_name,
      e.cohort_date,
      e.full_name,
      e.first_name,
      e.last_name,
      e.job_title,
      e.company,
      e.industry,
      e.location,
      e.country,
      e.email,
      e.normalized_email,
      e.phone,
      e.linkedin_url,
      e.website,
      coalesce(nullif(btrim(e.product_interest), ''), 'copy_trading'),
      e.broker,
      e.quality_score,
      'qualified',
      e.validation_status,
      e.qualification_status,
      'qualified',
      'ready_not_started',
      0,
      'none',
      'clear',
      'not_unsubscribed',
      false,
      jsonb_build_object(
        'promoted_by', 'gencouv_promote_verified_raw_leads',
        'promoted_at', now(),
        'raw_payload', e.payload
      )
    from eligible e
    on conflict (organization_id, normalized_email) do nothing
    returning id, raw_lead_id, normalized_email, email, full_name
  )
  select
    i.id,
    i.raw_lead_id,
    i.normalized_email,
    i.email,
    i.full_name
  from inserted i
  order by i.normalized_email;
$function$;

revoke all on function public.gencouv_promote_verified_raw_leads(uuid, integer) from public, anon, authenticated;
grant execute on function public.gencouv_promote_verified_raw_leads(uuid, integer) to service_role;
