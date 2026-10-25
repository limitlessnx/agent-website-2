import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('../STAGING_BASELINE_DEPENDENCY_PREFLIGHT.sql', import.meta.url), 'utf8');
const review = readFileSync(new URL('../STAGING_BASELINE_ROUTINE_SOURCE_REVIEW.md', import.meta.url), 'utf8');
const metadataPreview = readFileSync(new URL('../STAGING_BASELINE_DEPENDENCY_METADATA_PREVIEW.sql', import.meta.url), 'utf8');

function valuesIn(sectionPattern) {
  const match = sql.match(sectionPattern);
  assert.ok(match, 'expected VALUES section exists');
  return [...match[1].matchAll(/\('([^']+)'(?:,\s*'([^']+)')?\)/g)].map((row) => row[2] ? [row[1], row[2]] : row[1]);
}

test('supplemental preflight names all 17 relations outside the 42-table baseline', () => {
  const dependencies = valuesIn(/expected_dependencies\(module, table_name\) AS \(\s*VALUES([\s\S]*?)\n\),\nexpected_helpers/);
  assert.equal(dependencies.length, 17);
  assert.equal(new Set(dependencies.map(([, table]) => table)).size, 17);
  for (const [, table] of dependencies) assert.ok(review.includes(`\`${table}\``), `source review must include ${table}`);

  const previewTables = [...metadataPreview.matchAll(/^-- CREATE TABLE public\.(\w+)/gm)].map(([, table]) => table);
  assert.equal(previewTables.length, 17);
  assert.deepEqual([...previewTables].sort(), dependencies.map(([, table]) => table).sort());
  assert.match(metadataPreview, /outside the original approved 42-table allowlist/i);
});

test('supplemental preflight names the direct helper closure in the source review', () => {
  const helpers = valuesIn(/expected_helpers\(function_name\) AS \(\s*VALUES([\s\S]*?)\n\),\nmissing_tables/);
  assert.equal(helpers.length, 16);
  assert.equal(new Set(helpers).size, 16);
  for (const helper of helpers) assert.ok(review.includes(`\`${helper}\``), `source review must include ${helper}`);
});

test('supplemental preflight checks RLS, anonymous grants, and sensitive browser-role writes', () => {
  assert.match(sql, /dependency_rls_not_enabled/);
  assert.match(sql, /dependency_force_rls_unexpected/);
  assert.match(sql, /dependency_anon_direct_privilege/);
  assert.match(sql, /dependency_sensitive_authenticated_write/);
  assert.match(sql, /dependency_helper_missing/);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /has_table_privilege\('authenticated'/);

  assert.equal([...metadataPreview.matchAll(/^-- observed policy /gm)].length, 8);
  assert.equal([...metadataPreview.matchAll(/^-- observed trigger attachment /gm)].length, 12);
  assert.match(metadataPreview, /^-- observed direct grant: anon ->/m);
  assert.match(metadataPreview, /^-- observed policy payment_plans_tenant_member_access;/m);
  assert.match(metadataPreview, /not approved staging scope; do not execute/i);
});

test('supplemental preflight is catalog-only, read-only, and explicitly row-bounded', () => {
  const activeSql = sql.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('--')).join('\n');
  assert.match(activeSql, /^\s*WITH\b/i);
  assert.doesNotMatch(activeSql, /^\s*(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE|TRUNCATE|COPY)\b/im);
  assert.match(activeSql, /FROM\s+information_schema\.tables/i);
  assert.match(activeSql, /pg_catalog\.pg_class/i);
  assert.match(activeSql, /pg_catalog\.pg_proc/i);
  assert.match(activeSql, /LIMIT\s+200\s*;\s*$/i);
  assert.doesNotMatch(activeSql, /FROM\s+public\./i);

  const previewActiveSql = metadataPreview.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith('--')).join('\n');
  assert.equal(previewActiveSql, '', 'dependency metadata preview must remain entirely commented out');
});
