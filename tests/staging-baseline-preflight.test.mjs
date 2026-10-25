import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const preflight = readFileSync(new URL('../STAGING_BASELINE_PREFLIGHT.sql', import.meta.url), 'utf8');
const ddlPreview = readFileSync(new URL('../STAGING_BASELINE_DDL_PREVIEW.sql', import.meta.url), 'utf8');

function valuesIn(sectionPattern) {
  const match = preflight.match(sectionPattern);
  assert.ok(match, 'expected VALUES section exists');
  return [...match[1].matchAll(/\('([^']+)'(?:,\s*'([^']+)')?\)/g)].map((row) => row[2] ? [row[1], row[2]] : row[1]);
}

test('preflight table allowlist matches all 42 approved metadata tables', () => {
  const fromPreview = [...new Set([...ddlPreview.matchAll(/^-- CREATE TABLE public\.([a-z0-9_]+)\s*\(/gim)].map((m) => m[1]))].sort();
  const fromPreflight = valuesIn(/expected_tables\(table_name\) AS \(\s*VALUES([\s\S]*?)\n\),\nexpected_policies/).sort();
  assert.equal(fromPreview.length, 42);
  assert.deepEqual(fromPreflight, fromPreview);
});

test('preflight policy allowlist matches all 60 approved metadata policies', () => {
  const fromPreview = [...new Set([...ddlPreview.matchAll(/^-- CREATE POLICY ("[^"]+"|[a-z0-9_]+) ON public\.([a-z0-9_]+)/gim)].map((m) => [m[2], m[1].replace(/^"|"$/g, '')]))]
    .sort((a, b) => `${a[0]}.${a[1]}`.localeCompare(`${b[0]}.${b[1]}`));
  const fromPreflight = valuesIn(/expected_policies\(table_name, policy_name\) AS \(\s*VALUES([\s\S]*?)\n\),\nrequired_core_helpers/)
    .sort((a, b) => `${a[0]}.${a[1]}`.localeCompare(`${b[0]}.${b[1]}`));
  assert.equal(fromPreview.length, 60);
  assert.deepEqual(fromPreflight, fromPreview);
});

test('preflight includes core RLS, provisioning, and trigger-helper requirements', () => {
  const coreHelpers = valuesIn(/required_core_helpers\(function_name\) AS \(\s*VALUES([\s\S]*?)\n\),\nrequired_trigger_helpers/);
  const triggerHelpers = valuesIn(/required_trigger_helpers\(function_name\) AS \(\s*VALUES([\s\S]*?)\n\),\nchecks/);
  assert.equal(coreHelpers.length, 13);
  assert.equal(triggerHelpers.length, 12);
  for (const helper of [
    'is_organization_member', 'has_organization_permission', 'assert_real_estate_mutation_scope', 'create_human_handoff',
    'provision_client_workspace', 'provision_client_organization', 'provision_trial_client_organization',
    'timeline_from_appointment', 'timeline_from_crm_lead', 'sanitize_lead_budget_phone_collision',
    'seed_organization_role_presets_after_membership', 'seed_customer_stages_for_new_organization',
  ]) assert.ok(preflight.includes(`'${helper}'`), `missing helper ${helper}`);
  for (const rpc of ['provision_client_workspace', 'provision_client_organization', 'provision_trial_client_organization']) {
    assert.ok(preflight.includes(`'${rpc}'`), `missing provisioning ACL check for ${rpc}`);
  }
  assert.match(preflight, /has_function_privilege\('anon',\s*p\.oid,\s*'EXECUTE'\)/);
  assert.match(preflight, /has_function_privilege\('authenticated',\s*p\.oid,\s*'EXECUTE'\)/);
  assert.match(preflight, /has_function_privilege\('service_role',\s*p\.oid,\s*'EXECUTE'\)/);
});

test('preflight is catalog-only, read-only, and row-bounded', () => {
  const activeSql = preflight.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('--')).join('\n');
  assert.match(activeSql, /^\s*WITH\b/i);
  assert.doesNotMatch(activeSql, /^\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE|COPY)\b/im);
  assert.match(activeSql, /\bFROM\s+(?:information_schema\.tables|pg_catalog\.(?:pg_class|pg_policies|pg_proc|pg_namespace))\b/i);
  assert.match(activeSql, /c\.relforcerowsecurity/i);
  assert.match(activeSql, /LIMIT\s+250\s*;\s*$/i);
  assert.equal((activeSql.match(/LIMIT\s+1\b/gi) ?? []).length, 4);
});
