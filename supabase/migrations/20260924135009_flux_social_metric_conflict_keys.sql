drop index if exists public.social_post_metrics_external_snapshot_uidx;
create unique index social_post_metrics_external_snapshot_uidx
  on public.social_post_metrics (organization_id, platform, external_snapshot_key);

drop index if exists public.social_account_metrics_external_snapshot_uidx;
create unique index social_account_metrics_external_snapshot_uidx
  on public.social_account_metrics (organization_id, platform, external_snapshot_key);
