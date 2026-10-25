import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');

test('Xposure booking schema keeps bank account details out of the application database', () => {
 const sql = read('supabase/migrations/20261024120000_xposure_booking_payment_lifecycle.sql');
 assert.ok(sql.includes('public.xposure_bookings'));
 assert.ok(sql.includes("Payment instructions remain in Maia's knowledge base"));
 assert.ok(!sql.includes('xposure_payment_settings'));
 assert.ok(!sql.includes('account_number'));
 assert.ok(!sql.includes('account_name'));
 assert.ok(!sql.includes('bank_name'));
 assert.ok(sql.includes('Staff-entered workflow status only'));
});

test('booking and manual payment status records are tenant scoped and status constrained', () => {
 const sql = read('supabase/migrations/20261024120000_xposure_booking_payment_lifecycle.sql');
 assert.ok(sql.includes('unique (organization_id, idempotency_key)'));
 assert.ok(sql.includes("payment_status text not null default 'unpaid'"));
 assert.ok(sql.includes('enable row level security'));
});

test('staff actions require manual payment status before booking confirmation', () => {
 const route = read('app/api/admin/xposure/bookings/route.ts');
 assert.ok(route.includes('authorizeXposureTenantAccess("customers.manage")'));
 assert.ok(route.includes('current.payment_status !== "verified"'));
 assert.ok(route.includes('staff_approved_quote'));
 assert.ok(route.includes('.eq("organization_id", access.organizationId)'));
});

test('payment and booking transitions reject terminal states and prevent confirmed-time overlaps', () => {
 const route = read('app/api/admin/xposure/bookings/route.ts');
 assert.ok(route.includes('terminalStatuses.has(current.booking_status)'));
 assert.ok(route.includes('Only an active, unconfirmed booking can be confirmed.'));
 assert.ok(route.includes('.eq("booking_status", "confirmed")'));
 assert.ok(route.includes('.lt("requested_start_at", current.requested_end_at)'));
 assert.ok(route.includes('.gt("requested_end_at", current.requested_start_at)'));
 assert.ok(route.includes('This time overlaps another confirmed booking.'));
});

test('bookings dashboard exposes payment, confirm, and cancel actions with timezone-aware display', () => {
 const ui = read('components/admin/XposureBookingsPanel.tsx');
 assert.ok(ui.includes('"payment_received" | "confirm_booking" | "cancel_booking"'));
 assert.ok(ui.includes('Confirm Booking'));
 assert.ok(ui.includes('Cancel Booking'));
 assert.ok(ui.includes('timeZone: booking.timezone || "Africa/Lagos"'));
});

test('Maia runtime booking creation is secret-authenticated, Xposure-only, idempotent, and pending-only', () => {
 const route = read('app/api/internal/runtime/actions/xposure-bookings/route.ts');
 assert.ok(route.includes('assertRuntimeSecret'));
 assert.ok(route.includes('organization.slug !== "xposure"'));
 assert.ok(route.includes('onConflict: "organization_id,idempotency_key"'));
 assert.ok(route.includes('booking_status: "pending", payment_status: "unpaid"'));
 assert.ok(!route.includes('booking_status: "confirmed"'));
});
