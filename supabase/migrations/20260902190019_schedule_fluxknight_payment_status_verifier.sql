select cron.unschedule(jobid) from cron.job where jobname='fluxknight_payment_status_verifier';
select cron.schedule(
  'fluxknight_payment_status_verifier',
  '*/15 * * * *',
  $cron$
  select net.http_get(
    url := 'https://limitlessnx-agent-website-2.vercel.app/api/cron/payment-status',
    headers := jsonb_build_object(
      'x-maia-scheduler-token',
      (select decrypted_secret from vault.decrypted_secrets where name = 'maia_scheduler_secret')
    ),
    timeout_milliseconds := 10000
  );
  $cron$
);
