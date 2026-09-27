insert into public.billing_plans (name, slug, currency, installation_fee, recurring_fee, billing_interval, status, metadata)
values
  ('Starter', 'starter', 'NGN', 150000, 75000, 'monthly', 'active', '{"description":"One core agent for small teams"}'::jsonb),
  ('Growth', 'growth', 'NGN', 300000, 180000, 'monthly', 'active', '{"description":"Multi-agent sales and support automation"}'::jsonb),
  ('Business', 'business', 'NGN', 600000, 350000, 'monthly', 'active', '{"description":"Voice, advanced workflows and analytics"}'::jsonb),
  ('Enterprise', 'enterprise', 'NGN', 0, 0, 'custom', 'active', '{"description":"Custom limits, white label and priority support"}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  currency = excluded.currency,
  installation_fee = excluded.installation_fee,
  recurring_fee = excluded.recurring_fee,
  billing_interval = excluded.billing_interval,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

with plan_features(slug, feature_key, enabled, limit_value) as (
  values
    ('starter','agents',true,1),('starter','team_members',true,2),('starter','monthly_messages',true,1000),('starter','email_automation',false,0),('starter','voice_minutes',false,0),
    ('growth','agents',true,4),('growth','team_members',true,8),('growth','monthly_messages',true,10000),('growth','email_automation',true,5000),('growth','voice_minutes',false,0),
    ('business','agents',true,10),('business','team_members',true,25),('business','monthly_messages',true,50000),('business','email_automation',true,25000),('business','voice_minutes',true,1000),
    ('enterprise','agents',true,null),('enterprise','team_members',true,null),('enterprise','monthly_messages',true,null),('enterprise','email_automation',true,null),('enterprise','voice_minutes',true,null),('enterprise','white_label',true,1)
)
insert into public.plan_entitlements (plan_id, feature_key, enabled, limit_value, configuration)
select bp.id, pf.feature_key, pf.enabled, pf.limit_value, '{}'::jsonb
from plan_features pf
join public.billing_plans bp on bp.slug = pf.slug
on conflict (plan_id, feature_key) do update set
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  configuration = excluded.configuration,
  updated_at = now();
