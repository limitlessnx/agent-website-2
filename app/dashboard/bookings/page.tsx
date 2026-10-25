import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import XposureBookingsPanel from "@/components/admin/XposureBookingsPanel";

export const dynamic = "force-dynamic";

export default async function XposureBookingsPage() {
  if (!(await getAdminSession())) redirect("/login");
  const scope = await resolveAdminOrganizationScope();
  if (scope.status !== "active" || scope.kind !== "tenant" || scope.slug !== "xposure") {
    redirect("/dashboard");
  }
  return <main className="admin-page"><header style={{ marginBottom: 24 }}><p style={{ color: "var(--fk-muted, #777)", marginBottom: 6 }}>XPOSURE STUDIOS · CLIENT OPERATIONS</p><h1 style={{ margin: 0 }}>Bookings & payments</h1><p>Record payment only after the Xposure handover agent has independently confirmed the funds in the bank. Receipt screenshots alone are not confirmation.</p></header><XposureBookingsPanel /></main>;
}
