begin;

-- Some Maia agents route to a configured supervisor phone before that phone is
-- linked to an organization membership. Keep those WhatsApp notifications in
-- the canonical audit table without inventing a membership assignment.
alter table public.handoff_notifications
  alter column membership_id drop not null;

comment on column public.handoff_notifications.membership_id is
  'Nullable for phone-only agent handoff destinations; populated for member-routed notifications.';

commit;
