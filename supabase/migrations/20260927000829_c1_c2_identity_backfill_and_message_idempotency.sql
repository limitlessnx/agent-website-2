create unique index if not exists crm_conversations_org_channel_external_uidx
  on public.crm_conversations(organization_id,channel,external_thread_id)
  where external_thread_id is not null;

create unique index if not exists crm_messages_org_external_message_uidx
  on public.crm_messages(organization_id,external_message_id)
  where external_message_id is not null;

insert into public.customer_identifiers(
  organization_id,customer_id,identifier_type,normalized_value,is_primary,metadata
)
select c.organization_id,c.id,'email',public.normalize_customer_identifier('email',c.email),true,
       jsonb_build_object('source','phase_c_backfill')
from public.crm_customers c
where public.normalize_customer_identifier('email',c.email) is not null
on conflict(organization_id,identifier_type,normalized_value) do nothing;

insert into public.customer_identifiers(
  organization_id,customer_id,identifier_type,normalized_value,is_primary,metadata
)
select c.organization_id,c.id,'phone',public.normalize_customer_identifier('phone',c.phone),true,
       jsonb_build_object('source','phase_c_backfill')
from public.crm_customers c
where public.normalize_customer_identifier('phone',c.phone) is not null
on conflict(organization_id,identifier_type,normalized_value) do nothing;

insert into public.customer_identifiers(
  organization_id,customer_id,identifier_type,normalized_value,is_primary,metadata
)
select c.organization_id,c.id,'external',public.normalize_customer_identifier('external',c.external_key),true,
       jsonb_build_object('source','phase_c_backfill')
from public.crm_customers c
where public.normalize_customer_identifier('external',c.external_key) is not null
on conflict(organization_id,identifier_type,normalized_value) do nothing;
