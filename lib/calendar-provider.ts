import { createAdminClient } from "@/lib/supabase/admin";

type Json = Record<string, unknown>;

export type CalendarResource = {
  id: string;
  organization_id: string;
  integration_id: string;
  provider: string;
  external_calendar_id: string;
  display_name: string;
  organizer_email?: string | null;
  timezone: string;
  default_duration_minutes: number;
  is_default: boolean;
  status: string;
  availability_configuration?: Json | null;
  metadata?: Json | null;
};

export type CalendarEventInput = {
  calendarId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: string;
  endAt: string;
  timezone: string;
  attendeeEmail: string;
  attendeeName?: string | null;
  appointmentId: string;
  correlationId: string;
};

export type CalendarEventResult = {
  provider: string;
  calendarId: string;
  eventId: string;
  htmlLink?: string | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getIntegrationCredentials(organizationId: string, provider: string): Promise<Json> {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc("get_organization_integration_credentials", {
    p_organization_id: organizationId,
    p_provider: provider,
  });
  if (error) throw error;
  if (!data || typeof data !== "object") throw new Error(`Calendar credentials are missing for ${provider}.`);
  return data as Json;
}

async function refreshGoogleAccessToken(credentials: Json) {
  const refreshToken = text(credentials.refresh_token);
  const clientId = text(credentials.client_id);
  const clientSecret = text(credentials.client_secret);
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Google Calendar access token expired and refresh credentials are incomplete.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) throw new Error(text(body.error_description) || text(body.error) || "Google OAuth token refresh failed.");
  const accessToken = text(body.access_token);
  if (!accessToken) throw new Error("Google OAuth token refresh returned no access token.");
  return accessToken;
}

async function googleFetch(
  organizationId: string,
  provider: string,
  url: string,
  init: RequestInit,
) {
  const credentials = await getIntegrationCredentials(organizationId, provider);
  let accessToken = text(credentials.access_token);
  if (!accessToken) accessToken = await refreshGoogleAccessToken(credentials);

  const request = async (token: string) => fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  let response = await request(accessToken);
  if (response.status === 401 && text(credentials.refresh_token)) {
    accessToken = await refreshGoogleAccessToken(credentials);
    response = await request(accessToken);
  }
  return response;
}

function assertGoogleProvider(provider: string) {
  if (!["google_calendar", "google-calendar", "google"].includes(provider)) {
    throw new Error(`Unsupported calendar provider: ${provider}.`);
  }
}

export async function calendarSlotAvailable(input: {
  organizationId: string;
  resource: CalendarResource;
  startAt: string;
  endAt: string;
}) {
  assertGoogleProvider(input.resource.provider);
  const response = await googleFetch(
    input.organizationId,
    input.resource.provider,
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timeMin: input.startAt,
        timeMax: input.endAt,
        timeZone: input.resource.timezone,
        items: [{ id: input.resource.external_calendar_id }],
      }),
    },
  );
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    throw new Error(text(error?.message) || `Google Calendar free/busy check failed with ${response.status}.`);
  }

  const calendars = body.calendars as Record<string, Json> | undefined;
  const calendar = calendars?.[input.resource.external_calendar_id];
  const busy = Array.isArray(calendar?.busy) ? calendar?.busy as unknown[] : [];
  return busy.length === 0;
}

export async function createCalendarEvent(
  organizationId: string,
  provider: string,
  input: CalendarEventInput,
): Promise<CalendarEventResult> {
  assertGoogleProvider(provider);
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
  );
  url.searchParams.set("sendUpdates", "all");

  const response = await googleFetch(organizationId, provider, url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      summary: input.title,
      description: input.description || undefined,
      location: input.location || undefined,
      start: { dateTime: input.startAt, timeZone: input.timezone },
      end: { dateTime: input.endAt, timeZone: input.timezone },
      attendees: [{
        email: input.attendeeEmail,
        ...(input.attendeeName ? { displayName: input.attendeeName } : {}),
      }],
      extendedProperties: {
        private: {
          fluxknightAppointmentId: input.appointmentId,
          fluxknightCorrelationId: input.correlationId,
        },
      },
    }),
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    throw new Error(text(error?.message) || `Google Calendar event creation failed with ${response.status}.`);
  }
  const eventId = text(body.id);
  if (!eventId) throw new Error("Google Calendar created an event without returning an event ID.");
  return {
    provider,
    calendarId: input.calendarId,
    eventId,
    htmlLink: text(body.htmlLink) || null,
  };
}

export async function rescheduleCalendarEvent(input: {
  organizationId: string;
  resource: CalendarResource;
  eventId: string;
  startAt: string;
  endAt: string;
}) {
  assertGoogleProvider(input.resource.provider);
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.resource.external_calendar_id)}/events/${encodeURIComponent(input.eventId)}`,
  );
  url.searchParams.set("sendUpdates", "all");
  const response = await googleFetch(input.organizationId, input.resource.provider, url.toString(), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      start: { dateTime: input.startAt, timeZone: input.resource.timezone },
      end: { dateTime: input.endAt, timeZone: input.resource.timezone },
    }),
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    throw new Error(text(error?.message) || `Google Calendar reschedule failed with ${response.status}.`);
  }
  return { eventId: text(body.id) || input.eventId, htmlLink: text(body.htmlLink) || null };
}

export async function cancelCalendarEvent(input: {
  organizationId: string;
  resource: CalendarResource;
  eventId: string;
}) {
  assertGoogleProvider(input.resource.provider);
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.resource.external_calendar_id)}/events/${encodeURIComponent(input.eventId)}`,
  );
  url.searchParams.set("sendUpdates", "all");
  const response = await googleFetch(input.organizationId, input.resource.provider, url.toString(), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 410 && response.status !== 404) {
    const body = await response.json().catch(() => ({})) as Json;
    const error = body.error as Json | undefined;
    throw new Error(text(error?.message) || `Google Calendar cancellation failed with ${response.status}.`);
  }
}
