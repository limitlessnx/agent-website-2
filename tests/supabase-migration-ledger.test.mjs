import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDir = path.join(root, "supabase", "migrations");
const ledgerPath = path.join(root, "supabase", "migration-ledger.production-snapshot.json");
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const migrationFiles = readdirSync(migrationDir).filter((name) => name.endsWith(".sql"));
const versions = migrationFiles.map((name) => ({
  name,
  version: name.match(/^(\d+)_/)?.[1] ?? null,
}));

test("production migration ledger snapshot has no duplicate versions", () => {
  const seen = new Set();
  const duplicates = [];
  for (const entry of versions) {
    assert.ok(entry.version, `Migration filename has no version prefix: ${entry.name}`);
    if (seen.has(entry.version)) duplicates.push(entry.version);
    seen.add(entry.version);
  }
  assert.deepEqual(duplicates, [], "Duplicate local migration versions must be resolved");
});

const expectedPendingVersions = [
  "20261001233000",
  "202610020001",
  "202610020002",
  "20261002003000",
  "20261004150000",
  "20261007193000",
  "20261009230000",
  "20261011143000",
  "20261012090000",
  // Xposure studio catalog migrations reviewed but not yet applied to production.
  "20261021230000",
  "20261026170000",
];

test("pending local migrations match the explicitly reviewed release gate", () => {
  const remoteVersions = new Set(ledger.migrations.map((entry) => entry.version));
  const pending = [...new Set(versions.map((entry) => entry.version))]
    .filter((version) => !remoteVersions.has(version))
    .sort();
  assert.deepEqual(pending, [...expectedPendingVersions].sort(),
    "Any change to pending production migrations requires explicit review");
});

test("explicitly draft-only SQL is excluded from the deployable migration directory", () => {
  const draftOnly = migrationFiles.filter((name) => readFileSync(path.join(migrationDir, name), "utf8").includes("Draft only. Do not execute in production"));
  assert.deepEqual(draftOnly, [], "Draft-only SQL must live outside supabase/migrations");
});

test("every migration recorded remotely has a matching local SQL file", () => {
  assert.ok(Array.isArray(ledger.migrations), "Migration ledger snapshot is missing migrations");
  const localVersions = new Set(versions.map((entry) => entry.version));
  const missing = ledger.migrations.filter((entry) => !localVersions.has(entry.version));
  assert.deepEqual(
    missing.map(({ version, name }) => ({ version, name })),
    [],
    "Remote Supabase migration versions must not be absent from supabase/migrations",
  );
});
