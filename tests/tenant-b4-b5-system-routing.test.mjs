import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("B4 route templates provision only installed entitled systems",()=>{
  const migration=read("supabase/migrations/20260926202046_b4_automatic_system_event_routes.sql");
  assert.match(migration,/system_event_route_templates/);
  assert.match(migration,/sync_organization_system_event_routes/);
  assert.match(migration,/src\.status='active'/);
  assert.match(migration,/dst\.status='active'/);
  assert.match(migration,/organization_can_use_system/);
  assert.match(migration,/appointment\.requested/);
  assert.match(migration,/follow_up\.requested/);
  assert.match(migration,/appointment\.booked/);
});

test("B4 system activation synchronizes event routes",()=>{
  const service=read("lib/tenant-system-management.ts");
  const start=service.indexOf("export async function activateTenantSystem");
  assert.ok(start>=0);
  const activation=service.slice(start);
  assert.match(activation,/sync_organization_system_event_routes/);
  assert.match(activation,/route_sync/);
  const requestStart=service.indexOf("export async function requestTenantSystem");
  const requestEnd=service.indexOf("async function getInstallation",requestStart);
  const request=service.slice(requestStart,requestEnd);
  assert.doesNotMatch(request,/installation\.organization_id/);
});

test("B5 Appointment System has deterministic calendar adapters",()=>{
  const adapters=read("lib/system-event-adapters.ts");
  assert.match(adapters,/requestAppointment/);
  assert.match(adapters,/rescheduleAppointment/);
  assert.match(adapters,/cancelAppointment/);
  assert.match(adapters,/appointment\.email_required/);
  assert.match(adapters,/appointment\.calendar_required/);
  assert.match(adapters,/appointment\.slot_unavailable/);
  assert.match(adapters,/appointment\.booked/);
  assert.match(adapters,/source_event_id/);
  assert.match(adapters,/correlation_id/);
  assert.match(adapters,/sales_follow_up/);
});

test("B5 calendar provider resolves tenant Vault credentials and invites the customer",()=>{
  const provider=read("lib/calendar-provider.ts");
  assert.match(provider,/get_organization_integration_credentials/);
  assert.match(provider,/oauth2\.googleapis\.com\/token/);
  assert.match(provider,/calendar\/v3\/freeBusy/);
  assert.match(provider,/sendUpdates/);
  assert.match(provider,/attendees/);
  assert.match(provider,/fluxknightAppointmentId/);
  assert.doesNotMatch(provider,/NEXT_PUBLIC_/);
});

test("B4 B5 migrations define contracts, calendar resources, and tenant appointment FKs",()=>{
  const foundation=read("supabase/migrations/20260926221603_b4_b5_appointment_calendar_foundation.sql");
  const dispatch=read("supabase/migrations/20260926221837_b4_b5_channel_dispatch_alignment.sql");
  const contracts=read("supabase/migrations/20260926221916_b4_enforce_system_event_contracts.sql");
  assert.match(foundation,/system_event_contracts/);
  assert.match(foundation,/appointment_calendar_resources/);
  assert.match(foundation,/create table if not exists public\.appointments/);
  assert.match(foundation,/foreign key \(organization_id,customer_id\)/i);
  assert.match(foundation,/organization_system_sync_event_routes/);
  assert.match(dispatch,/dispatch_mode='agent_runtime'/);
  assert.match(contracts,/Unregistered or inactive system event contract/);
  assert.match(contracts,/missing required payload key/);
});

test("B5 tenant Appointments page uses the generic appointment model",()=>{
  const page=read("app/portal/appointments/page.tsx");
  assert.match(page,/appointments\?organization_id/);
  assert.doesNotMatch(page,/viewings\?organization_id/);
  assert.match(page,/Calendar linked/);
});

test("B5 orchestrator respects route dispatch mode",()=>{
  const service=read("lib/system-orchestrator.ts");
  assert.match(service,/dispatch_mode/);
  assert.match(service,/route\.dispatch_mode === "workflow_adapter"/);
  assert.match(service,/executeSystemWorkflowAdapter/);
  assert.match(service,/enqueue_agent_execution/);
});
