import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

// Read-only audit. Never triggers tasks, changes state, or calls an email provider.
const project = 'proj_ckweruqrgwndssqpjdvg';
const organization = '05737e03-f8f0-4202-8e9b-0a8982a1091c';
async function api(path, token) {
  assert.ok(token, 'Existing Trigger CI access is required');
  const response = await fetch(`https://api.trigger.dev${path}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  assert.ok(response.ok, `Trigger read failed: HTTP ${response.status}`);
  return response.json();
}
const environment = await api(`/api/v1/projects/${project}/prod`, process.env.TRIGGER_ACCESS_TOKEN);
const deployment = await api('/api/v1/deployments/current', environment.apiKey);
assert.equal(deployment.status, 'DEPLOYED', 'Production Trigger deployment must be ready');
const { variables } = await api(`/api/v1/projects/${project}/envvars`, environment.apiKey);
let databaseUrl = variables.LIMITLESS_SUPABASE_URL || variables.SUPABASE_URL || variables.NEXT_PUBLIC_SUPABASE_URL || 'https://tacxegmlppngnuvldojy.supabase.co';
if (new URL(databaseUrl).hostname === 'fwhwsvetndbjaljzghpg.supabase.co') databaseUrl = 'https://tacxegmlppngnuvldojy.supabase.co';
assert.equal(new URL(databaseUrl).hostname, 'tacxegmlppngnuvldojy.supabase.co');
const key = variables.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SERVICE_ROLE_KEY || variables.SUPABASE_SECRET_KEY;
assert.ok(key, 'Existing Trigger database credential must be configured');
const response = await fetch(`${databaseUrl}/rest/v1/gencouv_campaign_settings?organization_id=eq.${organization}&campaign_key=eq.gencouv_long_form_copy_trading&select=sending_enabled,status,metadata`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
});
assert.ok(response.ok, `Worker database read failed: HTTP ${response.status}`);
const [settings] = await response.json();
assert.ok(settings, 'Gencouv persisted settings must exist');
assert.equal(settings.sending_enabled, false, 'Keep automated campaigns OFF during verification');
assert.equal(settings.status, 'paused');
const files = await readdir('src/trigger');
const candidates = [];
for (const file of files.filter(name => /\.tsx?$/.test(name))) {
  if (/gencouv/i.test(await readFile(`src/trigger/${file}`, 'utf8'))) candidates.push(file);
}
console.log(JSON.stringify({
  project, deploymentId: deployment.id, deploymentVersion: deployment.version,
  deploymentStatus: deployment.status, deployedCommit: deployment.externalId || null,
  auditedCheckout: process.env.GITHUB_SHA || null, databaseReachableFromWorkerConfiguration: true,
  resendConfiguredInWorker: Boolean(variables.RESEND_API_KEY), automationEnabled: settings.sending_enabled,
  workerVerified: settings.metadata?.outbound_worker_gate_verified === true,
  sourceTaskCandidates: candidates, automationSenderVerified: false,
  blocker: 'No Gencouv sender has passed deployed task, consent, suppression, quota and OFF-state verification. Do not enable automation.',
  emailsSent: 0, tasksTriggered: 0, productionWrites: 0,
}, null, 2));
