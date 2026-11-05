import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { loadHotelWorkspace } from "@/lib/hotel-booking-service";
import HotelWorkspace from "@/components/portal/hotel/HotelWorkspace";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { hotelLocalDay,hotelNextDay } from "@/lib/hotel-overview-contract";
import { isCalendarDate } from "@/lib/hotel-booking-contract";
import { HOTEL_BOOKING_STATES } from "@/lib/hotel-communication-policy";
export const dynamic = "force-dynamic";
export const metadata = { title: "Hotel workspace | Fluxknight" };
export default async function HotelWorkspacePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
  const session = await getClientSession(); if (!session) redirect("/account/login");
  try { await requireHotelOrganization(session.organizationId); }
  catch { return <main className="portal-page"><h1>Hotel workspace unavailable</h1><p>Ask your administrator to check that this hotel workspace is active and correctly configured.</p></main>; }
  let permissions: Set<string>;
  try { permissions = session.isAdminPreview ? new Set(["customers.view", "billing.view"]) : (await requirePortalPermission(session, ["customers.view", "customers.manage"])).permissions; }
  catch { return <main className="portal-page"><h1>Hotel workspace</h1><p>You need guest-record access to use this workspace. Ask your hotel administrator to review your permissions.</p></main>; }
  const params=searchParams?await searchParams:{};const value=(key:string)=>typeof params[key]==="string"?params[key] as string:"";
  const profile=await getClientOnboardingProfile(session.organizationId).catch(()=>null);const calendar=hotelLocalDay(profile?.timezone);
  const arrival=isCalendarDate(value("arrival"))?value("arrival"):calendar.day;
  const guests=Number(value("guests")||1);
  const range = { arrival, departure: isCalendarDate(value("departure"))?value("departure"):hotelNextDay(arrival), guests:Number.isInteger(guests)&&guests>=1&&guests<=20?guests:1 };
  const selection={bookingId:/^[0-9a-f-]{36}$/i.test(value("booking"))?value("booking"):undefined,action:value("action"),tab:value("tab"),roomTypeId:value("roomType"),arrivalDay:isCalendarDate(value("arrivalDay"))?value("arrivalDay"):undefined,departureDay:isCalendarDate(value("departureDay"))?value("departureDay"):undefined,status:(HOTEL_BOOKING_STATES as readonly string[]).includes(value("filter"))?value("filter"):undefined};
  let data = null;
  try { data = await loadHotelWorkspace(session.organizationId, { ...range,arrivalDay:selection.arrivalDay,departureDay:selection.departureDay,status:selection.status, canManage: !session.isAdminPreview && permissions.has("customers.manage"), canManagePayments: !session.isAdminPreview && permissions.has("customers.manage") && permissions.has("billing.manage"), canViewPayments: permissions.has("billing.view") || permissions.has("billing.manage") }); } catch { /* Show a recoverable, nontechnical setup/load state. */ }
  return <HotelWorkspace initialData={data} initialRange={range} initialSelection={selection} initialError={data ? "" : "Unable to load this hotel workspace. Try again or ask your administrator to complete hotel setup."}/>;
}
