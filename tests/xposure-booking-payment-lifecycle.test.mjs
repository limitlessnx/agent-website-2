import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');

test('Xposure payment account is seeded only for Xposure and disabled until staff verifies it', () => {
  const sql = read('supabase/migrations/20261024120000_xposure_booking_payment_lifecycle.sql');
  assert.match(sql, /from public\.organizations where slug = 'xposure'/);
  assert.match(sql, /'UBA', 'Xposure Enterprise', '1029421643', 'NGN', false, false/);
  assert.match(sql, /on conflict \(organization_id\) do nothing/);
});

test('payment account endpoint fails closed and never exposes an unverified account', () => {
  const route = read('app/api/admin/xposure/payment-settings/route.ts');
  assert.match(route, /authorizeXposureTenantAccess\("systems\.view"\)/);
  assert.match(route, /data\.enabled === true && data\.verified === true/);
  assert.match(route, /account: enabled \?/);
  assert.match(route, /\.eq\("organization_id", access\.organizationId\)/);
});

test('booking and payment records are tenant scoped and status constrained', () => {
  const sql = read('supabase/migrations/20261024120000_xposure_booking_payment_lifecycle.sql');
  assert.match(sql, /unique \(organization_id, idempotency_key\)/);
  assert.match(sql, /booking_status in \('pending','awaiting_payment','payment_review','confirmed','completed','cancelled','expired'\)/);
  assert.match(sql, /payment_status in \('unpaid','receipt_submitted','verified','rejected','refunded'\)/);
  assert.match(sql, /booking_status <> 'confirmed' or \(payment_status = 'verified' and confirmed_at is not null\)/);
  assert.match(sql, /enable row level security/);
});

test('staff cannot confirm a booking until payment is verified and service quote is approved', () => {
  const route = read('app/api/admin/xposure/bookings/route.ts');
  assert.match(route, /authorizeXposureTenantAccess\("customers\.manage"\)/);
  assert.match(route, /current\.payment_status !== "verified"/);
  assert.match(route, /staff_approved_quote/);
  assert.match(route, /\.eq\("organization_id", access\.organizationId\)/);
  assert.match(route, /receipt_submitted/);
});

test('Maia runtime booking creation is secret-authenticated, Xposure-only, idempotent, and pending-only', () => {
  const route = read('app/api/internal/runtime/actions/xposure-bookings/route.ts');
  assert.match(route, /assertRuntimeSecret/);
  assert.match(route, /organization\.slug !== "xposure"/);
  assert.match(route, /\.eq\("organization_id", organizationId\)\.eq\("agent_id", agentId\)/);
  assert.match(route, /onConflict: "organization_id,idempotency_key"/);
  assert.match(route, /booking_status: "pending", payment_status: "unpaid"/);
  assert.doesNotMatch(route, /booking_status: "confirmed"/);
});
