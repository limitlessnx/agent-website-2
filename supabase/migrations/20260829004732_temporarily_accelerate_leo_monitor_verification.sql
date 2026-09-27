do $$
begin
  perform cron.unschedule('leo-proactive-monitor');
exception when others then null;
end $$;
select cron.schedule(
  'leo-proactive-monitor',
  '* * * * *',
  $$
    select net.http_get(
      url := 'https://limitlessnx-agent-website-2.vercel.app/api/cron/leo-monitor',
      headers := jsonb_build_object(
        'x-maia-scheduler-token',
        (select decrypted_secret from vault.decrypted_secrets where name = 'maia_scheduler_secret')
      ),
      timeout_milliseconds := 10000
    );
  $$
);
