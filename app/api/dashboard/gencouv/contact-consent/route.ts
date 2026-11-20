import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers });

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin?.email) return fail("Gencouv administrator session required.", 403);
  let organizationId: string;
  try {
    const scope = await requireAdminSystemScope("gencouv");
    if (scope.status === "unavailable" || !scope.organizationId) return fail("Gencouv organization required.", 403);
    organizationId = scope.organizationId;
  } catch {
    return fail("Gencouv organization required.", 403);
  }
  if (request.headers.get("origin") !== request.nextUrl.origin) return fail("Invalid request origin.", 403);
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!input || typeof input.customer_id !== "string" || !uuid.test(input.customer_id))
    return fail("Select an imported contact.");
  if (input.consent_accepted !== "yes" && input.consent_accepted !== "no")
    return fail("Confirm whether this contact previously gave marketing consent.");
  const accepted = input.consent_accepted === "yes";
  const basis = typeof input.consent_source === "string" ? input.consent_source.trim() : "";
  if (accepted && (basis.length < 8 || basis.length > 300))
    return fail("Provide the source of the contact's actual prior consent.", 400);
  const db = createAdminClient();
  const { data, error } = await db.rpc("gencouv_record_imported_contact_consent", {
    p_organization_id: organizationId,
    p_customer_id: input.customer_id,
    p_accepted: accepted,
    p_source: basis,
    p_admin_email: admin.email.trim().toLowerCase()
  });
  if (error || data !== true)
    return fail("Consent could not be recorded. Confirm the contact is imported, active, and not suppressed.", 409);
  return NextResponse.json({
    ok: true,
    status: accepted ? "granted" : "denied",
    note: accepted
      ? "Recorded the administrator's attestation of previously obtained consent."
      : "Recorded that marketing consent has not been obtained. Contact remains excluded."
  }, { headers });
}
