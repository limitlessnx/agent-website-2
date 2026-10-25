import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const access = await authorizeXposureTenantAccess("systems.view");
  if (!access.ok) return access.response;
  const { data, error } = await createAdminClient().from("xposure_payment_settings")
    .select("bank_name,account_name,account_number,currency,verified,enabled,staff_receipt_destination,updated_at")
    .eq("organization_id", access.organizationId).maybeSingle();
  if (error) return NextResponse.json({ error: "Payment settings are unavailable. Apply the Xposure booking/payment migration." }, { status: 503 });
  if (!data) return NextResponse.json({ configured: false, enabled: false, verified: false, account: null });
  const enabled = data.enabled === true && data.verified === true;
  return NextResponse.json({ configured: true, enabled, verified: data.verified === true, account: enabled ? {
    bankName: data.bank_name, accountName: data.account_name, accountNumber: data.account_number, currency: data.currency,
  } : null, staffReceiptDestination: data.staff_receipt_destination || null, updatedAt: data.updated_at });
}


export async function PUT(request: Request) {
  const access = await authorizeXposureTenantAccess("systems.manage");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.confirm !== true || typeof body.bankName !== "string" || typeof body.accountName !== "string" || typeof body.accountNumber !== "string") {
    return NextResponse.json({ error: "Explicit confirmation and complete bank details are required." }, { status: 400 });
  }
  const bankName = body.bankName.trim().slice(0, 80);
  const accountName = body.accountName.trim().slice(0, 120);
  const accountNumber = body.accountNumber.trim();
  const enabled = body.enabled === true;
  const verified = body.verified === true;
  const receiptDestination = typeof body.staffReceiptDestination === "string" ? body.staffReceiptDestination.trim().slice(0, 30) : null;
  if (!bankName || !accountName || !/^\d{10}$/.test(accountNumber)) return NextResponse.json({ error: "Bank name, account name and a 10-digit account number are required." }, { status: 400 });
  if (enabled && !verified) return NextResponse.json({ error: "Payment instructions cannot be enabled before staff verifies the account details." }, { status: 409 });
  if (receiptDestination && !/^\+?\d{7,15}$/.test(receiptDestination)) return NextResponse.json({ error: "Receipt destination must be a valid phone number." }, { status: 400 });
  const { error } = await createAdminClient().from("xposure_payment_settings").upsert({
    organization_id: access.organizationId, bank_name: bankName, account_name: accountName,
    account_number: accountNumber, currency: "NGN", verified, enabled,
    staff_receipt_destination: receiptDestination, updated_by: access.actorUserId, updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id" });
  if (error) return NextResponse.json({ error: "Payment settings could not be saved." }, { status: 500 });
  return NextResponse.json({ saved: true, enabled: enabled && verified, verified });
}
