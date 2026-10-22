import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20261009230000_phase2_plan_channel_allocations.sql", "utf8");

function sectionBetween(start, end = migration.length) {
  const startIndex = migration.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section: ${start}`);
  const endIndex = typeof end === "string" ? migration.indexOf(end, startIndex + start.length) : end;
  return migration.slice(startIndex, endIndex === -1 ? migration.length : endIndex);
}

test("Phase 2 creates organization-level allocation and channel tables", () => {
  assert.match(migration, /create table if not exists public\.organization_plan_allocations/);
  assert.match(migration, /create table if not exists public\.organization_channel_allocations/);
  assert.match(migration, /unique \(organization_id\)/);
  assert.match(migration, /unique \(organization_id, channel\)/);
  assert.match(migration, /cardinality\(selected_channels\) <= max_channels/);
});

test("Phase 2 encodes the homepage plan limits", () => {
  const sync = sectionBetween("create or replace function public.sync_organization_plan_allocation");
  assert.match(sync, /when 'plus' then 5000/);
  assert.match(sync, /when 'business' then 12000/);
  assert.match(sync, /when 'business_plus' then 25000/);
  assert.match(sync, /when 'basic' then 1 when 'plus' then 2 else 4 end/);
  assert.match(sync, /array\['web_chat','whatsapp','voice','email'\]/);
});

test("Phase 2 limits Basic and Plus channel selection to their supported channels", () => {
  const sync = sectionBetween("create or replace function public.sync_organization_plan_allocation", "create or replace function public.set_organization_selected_channels");
  assert.match(sync, /else array\['web_chat','whatsapp','voice'\]/);
  assert.match(migration, /check \(selected_channels <@ selectable_channels\)/);
  const select = sectionBetween("create or replace function public.set_organization_selected_channels");
  assert.match(select, /if cardinality\(v_channels\) > v_allocation\.max_channels/);
  assert.match(select, /not \(channel = any\(v_allocation\.selectable_channels\)\)/);
});

test("Phase 2 mutations are service-role-only while members can read snapshots", () => {
  assert.match(migration, /grant select on table public\.organization_plan_allocations, public\.organization_channel_allocations to authenticated/);
  assert.match(migration, /grant execute on function public\.organization_plan_allocation_snapshot\(uuid\) to authenticated, service_role/);
  assert.match(migration, /if auth\.uid\(\) is not null and not public\.is_organization_member\(p_organization_id\)/);
  assert.match(migration, /revoke all on function public\.sync_organization_plan_allocation\(uuid,text,uuid\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.sync_organization_plan_allocation\(uuid,text,uuid\) to service_role;/);
  assert.match(migration, /revoke all on function public\.set_organization_selected_channels\(uuid,jsonb,uuid\) from public, anon, authenticated;/);
  assert.match(migration, /grant execute on function public\.set_organization_selected_channels\(uuid,jsonb,uuid\) to service_role;/);
});

test("Phase 2 channel selection is idempotent and pauses removed channels", () => {
  const select = sectionBetween("create or replace function public.set_organization_selected_channels");
  assert.match(select, /on conflict \(organization_id, channel\) do update set/);
  assert.match(select, /set status = 'paused'/);
  assert.match(select, /return public\.organization_plan_allocation_snapshot\(p_organization_id\)/);
});

test("Phase 2 records channel-specific agent keys and setup states", () => {
  assert.match(migration, /when 'web_chat' then 'web_chat_agent'/);
  assert.match(migration, /when 'whatsapp' then 'whatsapp_agent'/);
  assert.match(migration, /when 'voice' then 'voice_agent'/);
  assert.match(migration, /when 'email' then 'email_agent'/);
  assert.match(migration, /setup_status text not null default 'pending'/);
  assert.match(migration, /allocation_status text not null default 'pending'/);
});
