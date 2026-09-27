create unique index if not exists gencouv_email_events_provider_event_uq on public.gencouv_email_events(provider, provider_event_id) where provider_event_id is not null;
create index if not exists gencouv_email_messages_org_recipient_idx on public.gencouv_email_messages(organization_id, recipient_email, created_at desc);
create index if not exists gencouv_email_messages_org_direction_idx on public.gencouv_email_messages(organization_id, direction, created_at desc);
create index if not exists gencouv_email_messages_provider_id_idx on public.gencouv_email_messages(provider, provider_email_id) where provider_email_id is not null;
create index if not exists gencouv_email_events_provider_id_idx on public.gencouv_email_events(provider, provider_email_id) where provider_email_id is not null;
create index if not exists gencouv_suppression_org_email_idx on public.gencouv_suppression_list(organization_id, normalized_email);
create index if not exists gencouv_campaign_enrollments_org_email_idx on public.gencouv_campaign_enrollments(organization_id, normalized_email);
create index if not exists gencouv_email_messages_reply_thread_idx on public.gencouv_email_messages(organization_id, reply_to_message_id, created_at);
