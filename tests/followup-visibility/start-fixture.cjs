/* eslint-disable @typescript-eslint/no-require-imports */
// Local read-only database substitute. No production secrets or provider access.
const http = require('node:http');
const { spawn } = require('node:child_process');
const { fixture } = require('../responsive/fixture-data.cjs');
const org = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const lead = '10000000-1111-4111-8111-111111111111';
const property = '20000000-1111-4111-8111-111111111111';
const sequence = '30000000-1111-4111-8111-111111111111';
const base = { organization_id: org, created_at: '2026-11-01T09:00:00Z', updated_at: '2026-11-22T09:00:00Z' };
const tables = {
  leads: [{ ...base, id: lead, name: 'Synthetic Active Client', phone: '2348000000001', email: 'active@example.test', status: 'in_conversation', follow_up_stage: 0, opted_out: false }, { ...base, id: '10000000-2222-4222-8222-222222222222', name: 'Historical Client', phone: '2348000000002', status: 'new', follow_up_stage: 5 }],
  properties: [{ ...base, id: property, title: 'Synthetic Estate with a Long Property Name for Mobile Layout Verification', status: 'active', price: 1000000, location_city: 'Benin City', location_area: 'Edo State' }],
  limitless_maia_followup_sequences: [{ ...base, id: sequence, lead_id: lead, status: 'active', consent_state: 'opted_in' }],
  follow_ups: [{ ...base, id: '40000000-1111-4111-8111-111111111111', lead_id: lead, customer_id: lead, property_id: property, sequence_id: sequence, status: 'sent', stage: 1, scheduled_at: '2026-11-10T09:30:00Z', sent_at: '2026-11-10T09:30:01Z', last_error: null }, ...[5, 6].map(stage => ({ ...base, id: `40000000-0000-4000-8000-00000000000${stage}`, lead_id: lead, customer_id: lead, property_id: property, sequence_id: sequence, status: 'pending', stage, scheduled_at: '2099-11-28T09:30:00Z', last_error: null }))],
  real_estate_outbound_tracking: [{ ...base, follow_up_id: '40000000-1111-4111-8111-111111111111', outbound_kind: 'followup', delivery_status: 'failed', error_message: 'Provider rejected delivery; review required' }],
  payment_plans: Array.from({ length: 7 }, (_, index) => ({ ...base, id: `50000000-0000-4000-8000-00000000000${index}`, client_name: `Synthetic Installment Client ${index}`, client_phone: '2348000000003', property_title: 'Synthetic Estate', payment_type: index === 6 ? 'outright' : 'installment', status: index < 5 ? 'active' : 'completed', reminders_enabled: index < 5, agreed_price: 1000000, total_paid: 200000, outstanding_balance: index < 5 ? 800000 : 0, installment_amount: 100000, currency: 'NGN', frequency: 'monthly', next_due_date: '2099-11-28', next_reminder_at: '2099-11-28T18:30:00Z', start_at: base.created_at })),
  reminder_attempts: ['sent', 'sent', 'failed', 'unknown', 'pending'].map((status, index) => ({ ...base, id: `attempt-${index}`, payment_plan_id: '50000000-0000-4000-8000-000000000000', status, scheduled_for: '2026-11-12T18:30:00Z', provider_reference: null })),
};
let unavailable = false;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const send = (status, value, count) => { res.writeHead(status, { 'Content-Type': 'application/json', ...(count === undefined ? {} : { 'Content-Range': `*/${count}` }) }); res.end(req.method === 'HEAD' ? '' : JSON.stringify(value)); };
  if (url.pathname === '/__qa/unavailable') { unavailable = url.searchParams.get('value') === '1'; return send(200, { unavailable }); }
  if (!['GET', 'HEAD'].includes(req.method)) return send(405, { message: 'Read-only fixture rejects writes and automation' });
  const table = url.pathname.split('/').pop();
  if (unavailable && ['limitless_maia_followup_sequences', 'reminder_attempts', 'real_estate_outbound_tracking'].includes(table)) return send(503, { message: 'Synthetic read outage' });
  let rows = tables[table] || fixture(url);
  if (table === 'organizations') rows = [{ ...base, id: org, slug: 'limitless-realty', name: 'Limitless Realty', status: 'active', metadata: { industry: 'real-estate' } }];
  if (Array.isArray(rows)) {
    for (const [key, value] of url.searchParams) {
      if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
      if (value.startsWith('gt.')) rows = rows.filter(row => Number(row[key]) > Number(value.slice(3)));
      if (value.startsWith('in.(')) rows = rows.filter(row => value.slice(4, -1).split(',').includes(String(row[key])));
    }
  }
  const count = Array.isArray(rows) ? rows.length : 1;
  if (req.headers.accept?.includes('application/vnd.pgrst.object+json')) rows = Array.isArray(rows) ? rows[0] || null : rows;
  return send(200, rows, count);
});
server.listen(4401, '127.0.0.1', () => {
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'NODE_EXTRA_CA_CERTS'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(env, { NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', SUPABASE_URL: 'http://127.0.0.1:4401', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:4401', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-test-key', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-test-key', ADMIN_SESSION_SECRET: 'synthetic-local-test-secret', CLIENT_SESSION_SECRET: 'synthetic-local-test-secret', LIMITLESS_ADMIN_EMAIL: 'admin@example.test', LIMITLESS_ADMIN_PASSWORD: 'synthetic-password' });
  const app = spawn(process.execPath, ['--require', './tests/social-realty/provider-mock.cjs', 'node_modules/next/dist/bin/next', 'dev', '--port', '4400', '--hostname', '127.0.0.1'], { env, stdio: 'inherit' });
  const stop = () => { app.kill('SIGTERM'); server.close(); }; process.on('SIGTERM', stop); process.on('SIGINT', stop); app.on('exit', code => { server.close(); process.exitCode = code || 0; });
});
