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
