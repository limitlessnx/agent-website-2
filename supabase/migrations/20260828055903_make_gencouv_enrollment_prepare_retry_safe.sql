create or replace function public.gencouv_prepare_daily_enrollments(
  p_organization_id uuid,
  p_campaign_key text default 'gencouv_long_form_copy_trading',
  p_requested_limit integer default null
)
returns table(
  enrollment_id uuid,
  lead_id uuid,
  normalized_email text,
  email text,
  first_name text,
  last_name text,
  full_name text,
  product_interest text,
  broker text,
  cohort_date date,
  campaign_status text
)
language sql
set search_path = public, pg_temp
as $function$
  with settings as (
    select least(200, greatest(30, coalesce(p_requested_limit, s.daily_new_lead_limit, 30))) as lead_limit
    from public.gencouv_campaign_settings s
    where s.organization_id = p_organization_id
      and s.campaign_key = p_campaign_key
    union all
    select least(200, greatest(30, coalesce(p_requested_limit, 30)))
    where not exists (
      select 1
      from public.gencouv_campaign_settings s
      where s.organization_id = p_organization_id
        and s.campaign_key = p_campaign_key
    )
    limit 1
  ), pending_existing as (
    select
      e.id as enrollment_id,
      q.id as lead_id,
      q.normalized_email,
      q.email,
      q.first_name,
      q.last_name,
      q.full_name,
      q.product_interest,
      q.broker,
      e.cohort_date,
      e.campaign_status,
      q.quality_score,
      q.created_at
    from public.gencouv_campaign_enrollments e
    join public.gencouv_qualified_leads q
      on q.organization_id = e.organization_id
     and q.normalized_email = e.normalized_email
    where e.organization_id = p_organization_id
      and e.campaign_key = p_campaign_key
      and e.campaign_status = 'pending_send'
      and q.normalized_email is not null
      and btrim(q.normalized_email) <> ''
      and lower(q.qualification_status) = 'qualified'
      and lower(coalesce(q.validation_status, 'valid')) not in ('invalid', 'failed', 'bounced', 'suppressed')
      and coalesce(q.do_not_contact, false) = false
      and lower(coalesce(q.suppression_status, 'clear')) not in ('suppressed', 'blocked', 'do_not_contact', 'complained')
      and lower(coalesce(q.unsubscribe_status, 'not_unsubscribed')) not in ('unsubscribed', 'opted_out', 'do_not_contact')
      and lower(coalesce(q.bounce_status, 'clear')) not in ('bounced', 'complained', 'failed', 'suppressed')
      and not exists (
        select 1
        from public.gencouv_suppression_list sl
        where sl.organization_id = q.organization_id
          and sl.normalized_email = q.normalized_email
      )
    order by q.quality_score desc, e.campaign_enrolled_at asc, e.id asc
    limit (select lead_limit from settings)
  ), eligible as (
    select q.*
    from public.gencouv_qualified_leads q
    where q.organization_id = p_organization_id
      and q.normalized_email is not null
      and btrim(q.normalized_email) <> ''
      and lower(q.qualification_status) = 'qualified'
      and lower(coalesce(q.validation_status, 'valid')) not in ('invalid', 'failed', 'bounced', 'suppressed')
      and lower(coalesce(q.campaign_status, 'qualified')) not in ('enrolled', 'active', 'completed', 'stopped')
      and lower(coalesce(q.email_sequence_status, 'ready_not_started')) not in ('enrolled', 'active', 'completed', 'stopped')
      and coalesce(q.do_not_contact, false) = false
      and lower(coalesce(q.suppression_status, 'clear')) not in ('suppressed', 'blocked', 'do_not_contact', 'complained')
      and lower(coalesce(q.unsubscribe_status, 'not_unsubscribed')) not in ('unsubscribed', 'opted_out', 'do_not_contact')
      and lower(coalesce(q.bounce_status, 'clear')) not in ('bounced', 'complained', 'failed', 'suppressed')
      and not exists (
        select 1
        from public.gencouv_suppression_list sl
        where sl.organization_id = q.organization_id
          and sl.normalized_email = q.normalized_email
      )
      and not exists (
        select 1
        from public.gencouv_campaign_enrollments e
        where e.organization_id = q.organization_id
          and e.campaign_key = p_campaign_key
          and e.normalized_email = q.normalized_email
      )
    order by q.quality_score desc, q.created_at asc, q.id asc
    limit greatest(0, (select lead_limit from settings) - (select count(*) from pending_existing))
  ), inserted as (
    insert into public.gencouv_campaign_enrollments (
      organization_id,
      campaign_key,
      lead_id,
      normalized_email,
      cohort_date,
      campaign_status,
      validation_status,
      qualification_status,
      current_sequence_step,
      campaign_enrolled_at,
      last_event_at,
      suppression_status,
      unsubscribe_status,
      do_not_contact,
      metadata
    )
    select
      e.organization_id,
      p_campaign_key,
      e.id::text,
      e.normalized_email,
      ((now() at time zone 'America/New_York')::date),
      'pending_send',
      e.validation_status,
      e.qualification_status,
      0,
      now(),
      now(),
      'clear',
      'not_unsubscribed',
      false,
      jsonb_build_object(
        'prepared_by', 'gencouv_prepare_daily_enrollments',
        'source', e.source,
        'source_id', e.source_id,
        'raw_lead_id', e.raw_lead_id,
        'prepared_at', now()
      )
    from eligible e
    on conflict on constraint gencouv_campaign_enrollments_unique_active do nothing
    returning *
  ), updated as (
    update public.gencouv_qualified_leads q
    set campaign_status = 'enrolled',
        email_sequence_status = 'pending_send',
        campaign_enrolled_at = coalesce(q.campaign_enrolled_at, now()),
        last_event_at = now(),
        updated_at = now()
    from inserted i
    where q.id::text = i.lead_id
    returning q.id, i.id as enrollment_id
  ), prepared_new as (
    select
      i.id as enrollment_id,
      e.id as lead_id,
      e.normalized_email,
      e.email,
      e.first_name,
      e.last_name,
      e.full_name,
      e.product_interest,
      e.broker,
      i.cohort_date,
      i.campaign_status,
      e.quality_score,
      e.created_at
    from inserted i
    join eligible e on e.id::text = i.lead_id
    join updated u on u.enrollment_id = i.id
  )
  select
    r.enrollment_id,
    r.lead_id,
    r.normalized_email,
    r.email,
    r.first_name,
    r.last_name,
    r.full_name,
    r.product_interest,
    r.broker,
    r.cohort_date,
    r.campaign_status
  from (
    select * from pending_existing
    union all
    select * from prepared_new
  ) r
  order by r.quality_score desc, r.created_at asc, r.lead_id asc
  limit (select lead_limit from settings);
$function$;

revoke all on function public.gencouv_prepare_daily_enrollments(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.gencouv_prepare_daily_enrollments(uuid, text, integer) to service_role;
