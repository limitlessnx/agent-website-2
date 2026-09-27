import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(path,"utf8");

test("F1 Google account auth starts server-side with PKCE and identity-only scopes",()=>{
  const button=read("app/account/GoogleAuthButton.tsx");
  const start=read("app/api/client-auth/google/start/route.ts");
  const callback=read("app/auth/callback/route.ts");
  assert.match(button,/\/api\/client-auth\/google\/start/);
  assert.match(start,/provider:"google"/);
  assert.match(start,/openid email profile/);
  assert.doesNotMatch(start,/calendar\.events|calendar\.freebusy|calendarlist/);
  assert.match(callback,/exchangeCodeForSession/);
  assert.match(callback,/getPrimaryMembership/);
  assert.match(callback,/setPendingClientSetupSession/);
  assert.match(callback,/setClientSession/);
});

test("F login and signup both expose Google account authentication",()=>{
  const login=read("app/account/login/LoginForm.tsx");
  const signup=read("app/account/signup/SignupForm.tsx");
  assert.match(login,/GoogleAuthButton/);
  assert.match(signup,/GoogleAuthButton/);
  assert.match(signup,/Create account with Google/);
});

test("F Google Calendar OAuth requests offline narrow calendar scopes",()=>{
  const oauth=read("lib/google-calendar-oauth.ts");
  assert.match(oauth,/calendar\.events/);
  assert.match(oauth,/calendar\.freebusy/);
  assert.match(oauth,/calendar\.calendarlist\.readonly/);
  assert.match(oauth,/access_type","offline"/);
  assert.match(oauth,/prompt","consent"/);
  assert.match(oauth,/include_granted_scopes","true"/);
  assert.doesNotMatch(oauth,/auth\/calendar"/);
});

test("F Google Calendar OAuth state is tenant and user bound",()=>{
  const oauth=read("lib/google-calendar-oauth.ts");
  const callback=read("app/api/integrations/google-calendar/callback/route.ts");
  assert.match(oauth,/organizationId/);
  assert.match(oauth,/userId/);
  assert.match(oauth,/timingSafeEqual/);
  assert.match(callback,/verified\.organizationId!==session\.organizationId/);
  assert.match(callback,/verified\.userId!==session\.userId/);
});

test("F tenant stores Google tokens in Vault through integration credential RPC",()=>{
  const callback=read("app/api/integrations/google-calendar/callback/route.ts");
  assert.match(callback,/upsert_integration_credentials/);
  assert.match(callback,/refresh_token/);
  assert.match(callback,/access_token/);
  assert.doesNotMatch(callback,/client_secret:/);
  assert.doesNotMatch(callback,/client_id:/);
});

test("F calendar runtime refreshes with platform-owned Google credentials",()=>{
  const provider=read("lib/calendar-provider.ts");
  const oauth=read("lib/google-calendar-oauth.ts");
  assert.match(provider,/platformGoogleCalendarCredentials/);
  assert.match(oauth,/GOOGLE_CALENDAR_CLIENT_ID/);
  assert.match(oauth,/GOOGLE_CALENDAR_CLIENT_SECRET/);
});

test("F calendar onboarding discovers writable calendars and requires explicit selection",()=>{
  const callback=read("app/api/integrations/google-calendar/callback/route.ts");
  const select=read("app/api/integrations/google-calendar/select/route.ts");
  const panel=read("app/portal/integrations/GoogleCalendarPanel.tsx");
  assert.match(callback,/listWritableGoogleCalendars/);
  assert.match(select,/upsert_appointment_calendar_resource/);
  assert.match(select,/status:"connected"/);
  assert.match(panel,/Use this calendar/);
  assert.match(panel,/Connect Google Calendar/);
});

test("F Google Calendar management is permission-gated",()=>{
  for(const path of [
    "app/api/integrations/google-calendar/connect/route.ts",
    "app/api/integrations/google-calendar/callback/route.ts",
    "app/api/integrations/google-calendar/select/route.ts",
    "app/api/integrations/google-calendar/disconnect/route.ts",
  ]){
    assert.match(read(path),/integrations\.manage/);
  }
});

test("F Calendar disconnect removes Vault binding via canonical RPC",()=>{
  const route=read("app/api/integrations/google-calendar/disconnect/route.ts");
  assert.match(route,/disconnect_organization_integration/);
  assert.match(route,/appointment_calendar_resources/);
  assert.match(route,/status:"disabled"/);
});

test("F environment contract keeps Google OAuth secrets server-only",()=>{
  const env=read(".env.example");
  assert.match(env,/GOOGLE_CALENDAR_CLIENT_ID=/);
  assert.match(env,/GOOGLE_CALENDAR_CLIENT_SECRET=/);
  assert.match(env,/GOOGLE_CALENDAR_REDIRECT_URI=/);
  assert.doesNotMatch(env,/NEXT_PUBLIC_GOOGLE_CALENDAR_CLIENT_SECRET/);
});


test("F1 Google OAuth preserves signed onboarding context through redirects",()=>{
  const auth=read("lib/client-auth.ts");
  const button=read("app/account/GoogleAuthButton.tsx");
  const start=read("app/api/client-auth/google/start/route.ts");
  const callback=read("app/auth/callback/route.ts");
  const setup=read("app/api/client-auth/setup-workspace/route.ts");
  assert.match(auth,/CLIENT_OAUTH_CONTEXT_COOKIE/);
  assert.match(auth,/httpOnly:true/);
  assert.match(auth,/trialPlan/);
  assert.match(auth,/invitationToken/);
  assert.match(button,/tx_ref/);
  assert.match(button,/invitation_token/);
  assert.match(start,/setClientOAuthContext/);
  assert.match(callback,/getClientOAuthContext/);
  assert.match(callback,/context\.txRef/);
  assert.match(callback,/context\.trialPlan/);
  assert.match(setup,/redirect_to/);
});

test("F1 invited Google users join the invited tenant before primary-membership fallback",()=>{
  const callback=read("app/auth/callback/route.ts");
  const invitationIndex=callback.indexOf("acceptOrganizationInvitation");
  const primaryIndex=callback.indexOf("membership=await getPrimaryMembership");
  assert.ok(invitationIndex>=0);
  assert.ok(primaryIndex>invitationIndex);
  assert.match(callback,/getMembershipForOrganization/);
});

test("F1 logout clears Supabase and Fluxknight auth state",()=>{
  const route=read("app/api/client-auth/logout/route.ts");
  assert.match(route,/supabase\.auth\.signOut/);
  assert.match(route,/clearClientSession/);
  assert.match(route,/clearPendingClientSetupSession/);
  assert.match(route,/clearClientOAuthContext/);
});

test("F1 Google start validates redirect destination and keeps provider scopes separate from Calendar",()=>{
  const start=read("app/api/client-auth/google/start/route.ts");
  assert.match(start,/startsWith\("\/"\)/);
  assert.match(start,/startsWith\("\/\/"\)/);
  assert.match(start,/new URL\("\/auth\/callback",url\.origin\)/);
  assert.doesNotMatch(start,/GOOGLE_CALENDAR_CLIENT_ID|GOOGLE_CALENDAR_CLIENT_SECRET/);
});


test("F1 switching between Google and email preserves invitation context",()=>{
  const login=read("app/account/login/LoginForm.tsx");
  const signup=read("app/account/signup/SignupForm.tsx");
  const loginPage=read("app/account/login/page.tsx");
  const signupPage=read("app/account/signup/page.tsx");
  assert.match(login,/invitation_token: invitationToken/);
  assert.match(signup,/invitation_token: invitationToken/);
  assert.match(login,/signupUrl\.searchParams\.set\("invitation_token"/);
  assert.match(signup,/loginUrl\.searchParams\.set\("invitation_token"/);
  assert.match(loginPage,/invitation_token/);
  assert.match(signupPage,/invitation_token/);
});

test("F1 workspace setup returns the preserved post-auth destination",()=>{
  const route=read("app/api/client-auth/setup-workspace/route.ts");
  const form=read("app/account/setup/SetupForm.tsx");
  assert.match(route,/pending\.nextPath/);
  assert.match(route,/pending\.txRef/);
  assert.match(route,/pending\.trialPlan/);
  assert.match(route,/redirect_to/);
  assert.match(form,/result\.redirect_to/);
});


test("F2 Calendar OAuth state fails closed in production and hints the signed-in Google account",()=>{
  const oauth=read("lib/google-calendar-oauth.ts");
  const connect=read("app/api/integrations/google-calendar/connect/route.ts");
  assert.match(oauth,/NODE_ENV!=="production"/);
  assert.match(oauth,/Google Calendar OAuth state signing is not configured/);
  assert.match(oauth,/login_hint/);
  assert.match(connect,/loginHint:session\.email/);
});

test("F2 rejects partial Google Calendar consent",()=>{
  const oauth=read("lib/google-calendar-oauth.ts");
  const callback=read("app/api/integrations/google-calendar/callback/route.ts");
  assert.match(oauth,/assertGoogleCalendarScopes/);
  assert.match(oauth,/calendar\.events/);
  assert.match(oauth,/calendar\.freebusy/);
  assert.match(oauth,/calendar\.calendarlist\.readonly/);
  assert.match(callback,/assertGoogleCalendarScopes\(tokens\.scope\)/);
});

test("F2 refreshed Google access tokens persist back to Vault without replacing refresh credentials",()=>{
  const migration=read("supabase/migrations/20260927113512_f2_persist_google_calendar_token_refresh.sql");
  const provider=read("lib/calendar-provider.ts");
  assert.match(migration,/refresh_organization_integration_access_token/);
  assert.match(migration,/v_credentials :=\s*v_credentials\s*\|\|/);
  assert.match(migration,/vault\.update_secret/);
  assert.match(migration,/to service_role/);
  assert.match(provider,/refresh_organization_integration_access_token/);
  assert.match(provider,/accessTokenExpired/);
});

test("F2 readiness verifies writable calendar state and is manager-gated",()=>{
  const readiness=read("app/api/integrations/google-calendar/readiness/route.ts");
  const panel=read("app/portal/integrations/GoogleCalendarPanel.tsx");
  assert.match(readiness,/integrations\.manage/);
  assert.match(readiness,/getValidGoogleCalendarAccessToken/);
  assert.match(readiness,/listWritableGoogleCalendars/);
  assert.match(readiness,/selection_required/);
  assert.match(readiness,/state:"ready"/);
  assert.match(panel,/Check connection/);
});

test("F2 disconnect removes Vault credentials and stale Calendar metadata",()=>{
  const route=read("app/api/integrations/google-calendar/disconnect/route.ts");
  assert.match(route,/disconnect_organization_integration/);
  assert.match(route,/connected_email/);
  assert.match(route,/available_calendars/);
  assert.match(route,/selected_calendar_id/);
  assert.match(route,/status:"disabled"/);
});

test("F2 Calendar callback clears the OAuth state cookie on every redirect outcome",()=>{
  const callback=read("app/api/integrations/google-calendar/callback/route.ts");
  assert.match(callback,/response\.cookies\.delete\("flux_google_calendar_oauth_state"\)/);
  assert.match(callback,/return redirect\(request,"cancelled"\)/);
  assert.match(callback,/return redirect\(request,"invalid_state"\)/);
});


test("F2 connection failures are explicit and readiness mutation stays manage-only",()=>{
  const connect=read("app/api/integrations/google-calendar/connect/route.ts");
  const readiness=read("app/api/integrations/google-calendar/readiness/route.ts");
  const panel=read("app/portal/integrations/GoogleCalendarPanel.tsx");
  assert.match(connect,/google_calendar=not_configured/);
  assert.match(readiness,/integrations\.manage/);
  assert.doesNotMatch(readiness,/\["integrations\.view","integrations\.manage"\]/);
  assert.match(panel,/canManage\?<button[^>]*Check connection|canManage\?<button/);
});


test("F3 calendar resources use tenant-bound staff ownership",()=>{
  const migration=read("supabase/migrations/20260927120801_f3_calendar_staff_resource_settings.sql");
  const fix=read("supabase/migrations/20260927120832_f3_calendar_staff_fk_delete_behavior.sql");
  assert.match(migration,/organization_memberships_organization_id_id_key/);
  assert.match(migration,/appointment_calendar_resources_staff_idx/);
  assert.match(migration,/update_appointment_calendar_resource_settings/);
  assert.match(migration,/Assigned staff member must be active in this organization/);
  assert.match(migration,/pg_timezone_names/);
  assert.match(fix,/on delete set null \(assigned_membership_id\)/i);
});

test("F3 appointments persist routed staff membership",()=>{
  const migration=read("supabase/migrations/20260927120950_f3_appointment_staff_assignment.sql");
  const adapter=read("lib/system-event-adapters.ts");
  assert.match(migration,/assigned_membership_id uuid/);
  assert.match(migration,/appointments_assigned_membership_org_fkey/);
  assert.match(adapter,/requestedMembershipId/);
  assert.match(adapter,/assigned_membership_id/);
  assert.match(adapter,/staffMembershipId/);
  assert.match(adapter,/No active calendar resource is configured for the requested staff member/);
});

test("F3 resource APIs are permission and tenant scoped",()=>{
  const create=read("app/api/integrations/google-calendar/resources/route.ts");
  const update=read("app/api/integrations/google-calendar/resources/[id]/route.ts");
  assert.match(create,/integrations\.manage/);
  assert.match(create,/appointments\.manage/);
  assert.match(create,/eq\("organization_id",session\.organizationId\)/);
  assert.match(create,/upsert_appointment_calendar_resource/);
  assert.match(create,/update_appointment_calendar_resource_settings/);
  assert.match(update,/eq\("organization_id",session\.organizationId\)/);
  assert.match(update,/update_appointment_calendar_resource_settings/);
});

test("F3 tenant UI supports multiple staff calendar resources",()=>{
  const page=read("app/portal/integrations/page.tsx");
  const panel=read("app/portal/integrations/GoogleCalendarPanel.tsx");
  assert.match(page,/assigned_membership_id/);
  assert.match(page,/default_duration_minutes/);
  assert.match(page,/listOrganizationMembers/);
  assert.match(panel,/Calendar resources/);
  assert.match(panel,/Assigned staff/);
  assert.match(panel,/Default duration/);
  assert.match(panel,/Default booking calendar/);
  assert.match(panel,/Add another staff calendar/);
});

test("F3 explicit staff routing precedes tenant default fallback",()=>{
  const adapter=read("lib/system-event-adapters.ts");
  const functionStart=adapter.indexOf("async function resolveCalendarResource");
  const functionEnd=adapter.indexOf("async function loadAppointment",functionStart);
  const block=adapter.slice(functionStart,functionEnd);
  const staffIndex=block.indexOf("requestedMembershipId");
  const defaultIndex=block.indexOf('eq("is_default", true)');
  assert.ok(staffIndex>=0);
  assert.ok(defaultIndex>staffIndex);
});


test("F5 availability engine enforces business rules before Google free busy",()=>{
  const scheduling=read("lib/appointment-scheduling.ts");
  assert.match(scheduling,/minimumNoticeMinutes/);
  assert.match(scheduling,/maximumAdvanceDays/);
  assert.match(scheduling,/blockedDates/);
  assert.match(scheduling,/workingHours/);
  assert.match(scheduling,/breaks/);
  assert.match(scheduling,/bufferBeforeMinutes/);
  assert.match(scheduling,/bufferAfterMinutes/);
  assert.match(scheduling,/calendarSlotAvailable/);
  assert.ok(scheduling.indexOf("evaluateAvailabilityPolicy")<scheduling.indexOf("calendarSlotAvailable"));
});

test("F5 availability is timezone aware and supports service durations",()=>{
  const scheduling=read("lib/appointment-scheduling.ts");
  assert.match(scheduling,/Intl\.DateTimeFormat/);
  assert.match(scheduling,/timeZone/);
  assert.match(scheduling,/serviceDurations/);
  assert.match(scheduling,/Appointments must fit within one local working day/);
});

test("F5 blocks overlapping Fluxknight appointments in addition to provider free busy",()=>{
  const scheduling=read("lib/appointment-scheduling.ts");
  assert.match(scheduling,/hasFluxknightOverlap/);
  assert.match(scheduling,/pending_availability/);
  assert.match(scheduling,/confirmed/);
  assert.match(scheduling,/rescheduled/);
  assert.match(scheduling,/lt\("start_at"/);
  assert.match(scheduling,/gt\("end_at"/);
});

test("F6 routing supports explicit staff, tags, default, least busy and round robin",()=>{
  const migration=read("supabase/migrations/20260927123647_f5_f6_availability_and_intelligent_routing.sql");
  const scheduling=read("lib/appointment-scheduling.ts");
  assert.match(migration,/service_keys text\[\]/);
  assert.match(migration,/branch_key/);
  assert.match(migration,/department_key/);
  assert.match(migration,/appointment_routing_settings/);
  assert.match(migration,/least_busy/);
  assert.match(migration,/round_robin/);
  assert.match(scheduling,/requestedMembershipId/);
  assert.match(scheduling,/specificity/);
  assert.match(scheduling,/leastBusyOrder/);
  assert.match(scheduling,/roundRobinOrder/);
  assert.match(scheduling,/advance_appointment_round_robin/);
});

test("F6 explicit staff routing never silently falls back to another staff member",()=>{
  const scheduling=read("lib/appointment-scheduling.ts");
  assert.match(scheduling,/const explicit=Boolean\(request\.requestedResourceId\|\|request\.requestedMembershipId\)/);
  assert.match(scheduling,/if\(!candidates\.length&&settings\.fallbackToDefault&&!explicit\)/);
});

test("F5 F6 appointment adapter uses policy routing for booking and rescheduling",()=>{
  const adapter=read("lib/system-event-adapters.ts");
  assert.match(adapter,/selectAppointmentResource/);
  assert.match(adapter,/evaluateResourceAvailability/);
  assert.match(adapter,/serviceKey/);
  assert.match(adapter,/branchKey/);
  assert.match(adapter,/departmentKey/);
  assert.match(adapter,/routing_strategy/);
  assert.match(adapter,/assignedMembershipId/);
});

test("F5 F6 tenant configuration exposes availability and automatic staff routing",()=>{
  const panel=read("app/portal/integrations/GoogleCalendarPanel.tsx");
  const page=read("app/portal/integrations/page.tsx");
  const resourceRoute=read("app/api/integrations/google-calendar/resources/[id]/route.ts");
  const routingRoute=read("app/api/integrations/google-calendar/routing/route.ts");
  assert.match(panel,/Enforce staff working hours/);
  assert.match(panel,/Minimum booking notice/);
  assert.match(panel,/Maximum advance booking/);
  assert.match(panel,/Buffer before/);
  assert.match(panel,/Blocked dates/);
  assert.match(panel,/Service durations/);
  assert.match(panel,/Automatic staff routing/);
  assert.match(panel,/Least busy/);
  assert.match(panel,/Round robin/);
  assert.match(page,/appointment_routing_settings/);
  assert.match(resourceRoute,/update_appointment_resource_scheduling_policy/);
  assert.match(routingRoute,/set_appointment_routing_settings/);
});

test("F5 F6 mutation RPCs remain service role only",()=>{
  const migration=read("supabase/migrations/20260927123647_f5_f6_availability_and_intelligent_routing.sql");
  assert.match(migration,/revoke all on function public\.update_appointment_resource_scheduling_policy[\s\S]*from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.update_appointment_resource_scheduling_policy[\s\S]*to service_role/);
  assert.match(migration,/revoke all on function public\.set_appointment_routing_settings[\s\S]*from public,anon,authenticated/);
  assert.match(migration,/advance_appointment_round_robin/);
});
