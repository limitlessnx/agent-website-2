alter view public.gencouv_email_analytics set (security_invoker = true);

alter function public.set_updated_at() set search_path = '';
alter function public.sanitize_lead_budget_phone_collision() set search_path = '';

revoke all on function public.seed_customer_stages_for_new_organization() from public, anon, authenticated;
revoke all on function public.sync_flux_credit_threshold_notification() from public, anon, authenticated;
revoke all on function public.sync_flux_subscription_wallet_trigger() from public, anon, authenticated;
revoke all on function public.timeline_from_appointment() from public, anon, authenticated;
revoke all on function public.timeline_from_crm_lead() from public, anon, authenticated;
revoke all on function public.timeline_from_crm_message() from public, anon, authenticated;
revoke all on function public.timeline_from_crm_task() from public, anon, authenticated;
revoke all on function public.timeline_from_domain_event() from public, anon, authenticated;

grant execute on function public.seed_customer_stages_for_new_organization() to service_role;
grant execute on function public.sync_flux_credit_threshold_notification() to service_role;
grant execute on function public.sync_flux_subscription_wallet_trigger() to service_role;
grant execute on function public.timeline_from_appointment() to service_role;
grant execute on function public.timeline_from_crm_lead() to service_role;
grant execute on function public.timeline_from_crm_message() to service_role;
grant execute on function public.timeline_from_crm_task() to service_role;
grant execute on function public.timeline_from_domain_event() to service_role;
