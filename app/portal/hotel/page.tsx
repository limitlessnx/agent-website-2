import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { loadHotelWorkspace } from "@/lib/hotel-booking-service";
import HotelWorkspace from "@/components/portal/hotel/HotelWorkspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Hotel workspace | Fluxknight" };
export default async function HotelWorkspacePage() {
  const session = await getClientSession(); if (!session) redirect("/account/login");
  try { await requireHotelOrganization(session.organizationId); }
  catch { return <main className="portal-page"><h1>Hotel workspace unavailable</h1><p>Ask your administrator to check that this hotel workspace is active and correctly configured.</p></main>; }
  let permissions: Set<string>;
  try { permissions = session.isAdminPreview ? new Set(["customers.view", "billing.view"]) : (await requirePortalPermission(session, ["customers.view", "customers.manage"])).permissions; }
  catch { return <main className="portal-page"><h1>Hotel workspace</h1><p>You need guest-record access to use this workspace. Ask your hotel administrator to review your permissions.</p></main>; }
  const start = new Date(); const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);
  const range = { arrival: start.toISOString().slice(0, 10), departure: end.toISOString().slice(0, 10), guests: 1 };
  let data = null;
  try { data = await loadHotelWorkspace(session.organizationId, { ...range, canManage: !session.isAdminPreview && permissions.has("customers.manage"), canManagePayments: !session.isAdminPreview && permissions.has("customers.manage") && permissions.has("billing.manage"), canViewPayments: permissions.has("billing.view") || permissions.has("billing.manage") }); } catch { /* Show a recoverable, nontechnical setup/load state. */ }
  return <HotelWorkspace initialData={data} initialRange={range} initialError={data ? "" : "Unable to load this hotel workspace. Try again or ask your administrator to complete hotel setup."}/>;
}
