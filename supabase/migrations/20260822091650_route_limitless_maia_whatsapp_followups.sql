-- Establish the canonical Maia WhatsApp follow-up template registry for Limitless Realty.
insert into public.whatsapp_template_configs
  (organization_id, purpose, template_name, language_code, variable_keys, status, metadata)
select
  'b15f21b4-5697-4d21-9421-8a34eae3476d',
  v.purpose,
  v.template_name,
  'en_US',
  v.variable_keys::jsonb,
  'active',
  jsonb_build_object(
    'agent', 'maia',
    'channel', 'whatsapp',
    'follow_up_stage', v.stage,
    'day', v.day,
    'strategy', v.strategy,
    'provider_status', 'pending_approval',
    'organization_slug', 'limitless-realty'
  )
from (values
  ('follow_up_day_1','maia_limitless_followup_day1',1,1,'Natural continuation of the lead conversation', '["lead_name","property_interest","last_customer_message","conversation_summary"]'),
  ('follow_up_day_3','maia_limitless_followup_day3',2,3,'Provide useful property or investment information relevant to the lead', '["lead_name","property_interest","conversation_summary","customer_goal"]'),
  ('follow_up_day_7','maia_limitless_followup_day7',3,7,'Address an unresolved concern or objection without repeating prior questions', '["lead_name","property_interest","last_objection","conversation_summary"]'),
  ('follow_up_day_14','maia_limitless_followup_day14',4,14,'Reconnect the property to the customer stated goal and decision context', '["lead_name","property_interest","customer_goal","conversation_summary"]'),
  ('follow_up_day_21','maia_limitless_followup_day21',5,21,'Soft re-engagement with a useful, low-pressure reason to respond', '["lead_name","property_interest","conversation_summary","last_customer_message"]'),
  ('follow_up_day_30','maia_limitless_followup_day30',6,30,'Graceful transition from active follow-up to longer-term nurture', '["lead_name","property_interest","conversation_summary","customer_goal"]')
) as v(purpose,template_name,stage,day,strategy,variable_keys)
where not exists (
  select 1 from public.whatsapp_template_configs c
  where c.organization_id='b15f21b4-5697-4d21-9421-8a34eae3476d'
    and c.template_name=v.template_name
);

-- Make the canonical Limitless Realty policy explicitly resolve to Maia + WhatsApp.
update public.organization_follow_up_policies
set channel_policy = jsonb_set(
      jsonb_set(coalesce(channel_policy,'{}'::jsonb), '{preferred}', '["whatsapp"]'::jsonb, true),
      '{agent}', '"maia"'::jsonb, true
    ),
    message_strategy = jsonb_set(
      jsonb_set(coalesce(message_strategy,'{}'::jsonb), '{contextual}', 'true'::jsonb, true),
      '{template_registry}', '"whatsapp_template_configs"'::jsonb, true
    ),
    updated_at = now()
where organization_id='b15f21b4-5697-4d21-9421-8a34eae3476d';

-- Add a routing contract to follow-up rows without changing existing records.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='follow_ups' and column_name='channel'
  ) then
    alter table public.follow_ups add column channel text not null default 'whatsapp';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='follow_ups' and column_name='agent_key'
  ) then
    alter table public.follow_ups add column agent_key text not null default 'maia';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='follow_ups' and column_name='template_name'
  ) then
    alter table public.follow_ups add column template_name text;
  end if;
end $$;

-- Backfill existing Limitless Realty follow-up rows to the canonical template route.
update public.follow_ups f
set channel='whatsapp', agent_key='maia', template_name='maia_limitless_followup_day' || f.stage
where f.organization_id='b15f21b4-5697-4d21-9421-8a34eae3476d'
  and f.stage between 1 and 6;

create index if not exists idx_follow_ups_limitless_due
  on public.follow_ups (organization_id, status, scheduled_at)
  where status in ('pending','scheduled','queued');

create index if not exists idx_whatsapp_templates_limitless_route
  on public.whatsapp_template_configs (organization_id, template_name, status);
